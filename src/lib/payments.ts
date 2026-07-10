// Payment orchestration: deposit → confirmation, balance (+ security
// deposit), tiered cancellation refunds, post-event security settlement.
// State changes are driven by markPaymentSucceeded/-Failed, which the Stripe
// webhook (or the dev simulator) calls — never client-side redirects.

import type { Booking, Client, Space, Venue } from "@/generated/prisma/client";
import { db } from "./db";
import { transitionBooking } from "./booking";
import {
  balanceReminderEmail,
  cancellationEmail,
  depositReceiptEmail,
  securityRefundEmail,
  type BookingSummary,
  type VenueBrand,
} from "./email-templates";
import { sendEmail } from "./email";
import { formatMoney } from "./money";
import {
  computeCancellationRefund,
  computeSecurityRefund,
  type CancellationTier,
  type SecurityDeduction,
} from "./pricing";
import { createPaymentSession, refundStripePayment } from "./stripe";
import { calendarDaysUntil } from "./time";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function brandOf(venue: Venue): VenueBrand {
  return {
    name: venue.name,
    logoUrl: venue.logoUrl,
    brandColor: venue.brandColor,
    email: venue.email,
    phone: venue.phone,
    timezone: venue.timezone,
    currency: venue.currency,
  };
}

export function summaryOf(
  booking: Booking & { client: Client; space: Space }
): BookingSummary {
  return {
    clientName: booking.client.name,
    spaceName: booking.space.name,
    eventType: booking.eventType.replaceAll("_", " ").toLowerCase(),
    start: booking.start,
    end: booking.end,
    guestCount: booking.guestCount,
    totalCents: booking.totalCents,
    depositCents: booking.depositCents,
    balanceDueDate: booking.balanceDueDate,
    securityDepositCents: booking.securityDepositCents,
    manageUrl: `${appUrl()}/b/${booking.manageToken}`,
  };
}

export type FullBooking = Booking & { client: Client; space: Space; venue: Venue };

export async function getFullBooking(bookingId: string): Promise<FullBooking> {
  return db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { client: true, space: true, venue: true },
  });
}

/** Total succeeded non-refund payments (deposit + balance), excl. security. */
export function paidTowardsBooking(
  payments: { type: string; status: string; amountCents: number }[]
): number {
  return payments
    .filter(
      (p) =>
        p.status === "SUCCEEDED" &&
        (p.type === "BOOKING_DEPOSIT" || p.type === "BALANCE")
    )
    .reduce((s, p) => s + p.amountCents, 0);
}

export function securityHeld(
  payments: { type: string; status: string; amountCents: number }[]
): number {
  const collected = payments
    .filter((p) => p.status === "SUCCEEDED" && p.type === "SECURITY_DEPOSIT")
    .reduce((s, p) => s + p.amountCents, 0);
  const refunded = payments
    .filter((p) => p.status === "SUCCEEDED" && p.type === "SECURITY_REFUND")
    .reduce((s, p) => s + p.amountCents, 0);
  return collected - refunded;
}

// ---------------------------------------------------------------------------
// Start payments
// ---------------------------------------------------------------------------

async function startPayment(args: {
  booking: FullBooking;
  type: "BOOKING_DEPOSIT" | "BALANCE" | "SECURITY_DEPOSIT";
  amountCents: number;
  description: string;
  successPath?: string;
}): Promise<string> {
  const { booking } = args;
  const payment = await db.payment.create({
    data: {
      venueId: booking.venueId,
      bookingId: booking.id,
      type: args.type,
      status: "PENDING",
      amountCents: args.amountCents,
      currency: booking.venue.currency,
    },
  });
  const manageUrl = `${appUrl()}/b/${booking.manageToken}`;
  const session = await createPaymentSession({
    bookingId: booking.id,
    paymentId: payment.id,
    venueStripeAccountId: booking.venue.stripeAccountId,
    amountCents: args.amountCents,
    currency: booking.venue.currency,
    description: args.description,
    customerEmail: booking.client.email,
    successUrl: args.successPath ?? `${manageUrl}?paid=1`,
    cancelUrl: manageUrl,
    collectApplicationFee: args.type !== "SECURITY_DEPOSIT",
  });
  await db.payment.update({
    where: { id: payment.id },
    data: { stripeCheckoutSessionId: session.sessionId },
  });
  return session.url;
}

/** Payment link for the booking deposit (confirms the booking on success). */
export async function startDepositPayment(bookingId: string, successPath?: string) {
  const booking = await getFullBooking(bookingId);
  return startPayment({
    booking,
    type: "BOOKING_DEPOSIT",
    amountCents: booking.depositCents,
    description: `Booking deposit — ${booking.space.name}, ${booking.venue.name}`,
    successPath,
  });
}

/** Payment link for the remaining balance + security deposit. */
export async function startBalancePayment(bookingId: string) {
  const booking = await getFullBooking(bookingId);
  const payments = await db.payment.findMany({ where: { bookingId } });
  const paid = paidTowardsBooking(payments);
  const balance = Math.max(0, booking.totalCents - paid);
  const security = booking.securityDepositCents - securityHeld(payments);
  const amount = balance + Math.max(0, security);
  if (amount <= 0) throw new Error("Nothing left to pay");
  return startPayment({
    booking,
    type: security > 0 && balance === 0 ? "SECURITY_DEPOSIT" : "BALANCE",
    amountCents: amount,
    description:
      security > 0
        ? `Balance + refundable security deposit — ${booking.space.name}`
        : `Balance — ${booking.space.name}, ${booking.venue.name}`,
  });
}

// ---------------------------------------------------------------------------
// Webhook-driven state
// ---------------------------------------------------------------------------

export async function markPaymentSucceeded(
  paymentId: string,
  refs: { paymentIntentId?: string | null }
): Promise<void> {
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.status === "SUCCEEDED") return; // idempotent

  await db.payment.update({
    where: { id: paymentId },
    data: {
      status: "SUCCEEDED",
      stripePaymentIntentId: refs.paymentIntentId ?? `pi_dev_${paymentId}`,
    },
  });

  const booking = await getFullBooking(payment.bookingId);

  if (payment.type === "BOOKING_DEPOSIT" && booking.status !== "CONFIRMED") {
    // HOLD / QUOTE_SENT / PENCILED / INQUIRY → CONFIRMED. The exclusion
    // constraint re-checks the slot on this UPDATE.
    const res = await transitionBooking(booking.id, "CONFIRMED", {
      holdExpiresAt: null,
    });
    if (!res.ok) {
      // Paid but the slot was snatched (should be impossible when the HOLD
      // itself blocked the slot). Flag for the owner rather than swallow.
      await db.booking.update({
        where: { id: booking.id },
        data: { notes: `${booking.notes ?? ""}\n⚠ Deposit paid but slot conflict on confirm — needs attention.` },
      });
      return;
    }
    if (booking.client.email) {
      const email = depositReceiptEmail(brandOf(booking.venue), summaryOf(booking), payment.amountCents);
      await sendEmail({ to: booking.client.email, ...email, replyTo: booking.venue.email ?? undefined });
    }
  }
}

export async function markPaymentFailed(paymentId: string): Promise<void> {
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.status !== "PENDING") return;
  await db.payment.update({ where: { id: paymentId }, data: { status: "FAILED" } });
}

// ---------------------------------------------------------------------------
// Cancellation with tiered refunds
// ---------------------------------------------------------------------------

export async function cancelBookingWithRefund(
  bookingId: string,
  reason: string
): Promise<{ refundCents: number; refundPct: number; securityRefundCents: number }> {
  const booking = await getFullBooking(bookingId);
  if (booking.status === "CANCELLED") {
    return { refundCents: 0, refundPct: 0, securityRefundCents: 0 };
  }
  const payments = await db.payment.findMany({ where: { bookingId } });
  const paid = paidTowardsBooking(payments);
  const security = securityHeld(payments);
  const tiers = booking.venue.cancellationTiers as unknown as CancellationTier[];
  const daysBefore = calendarDaysUntil(new Date(), booking.start, booking.venue.timezone);
  const { refundPct, refundCents } = computeCancellationRefund(paid, tiers, Math.max(0, daysBefore));

  // Refund the paid amount per policy; security deposit always in full.
  const refundable: { amount: number; type: "REFUND" | "SECURITY_REFUND"; source: typeof payments[number] | undefined }[] = [];
  if (refundCents > 0) {
    refundable.push({
      amount: refundCents,
      type: "REFUND",
      source: payments.find((p) => p.status === "SUCCEEDED" && p.type === "BOOKING_DEPOSIT"),
    });
  }
  if (security > 0) {
    refundable.push({
      amount: security,
      type: "SECURITY_REFUND",
      source: payments.find((p) => p.status === "SUCCEEDED" && p.type === "SECURITY_DEPOSIT"),
    });
  }

  for (const r of refundable) {
    const stripeRefundId = await refundStripePayment({
      venueStripeAccountId: booking.venue.stripeAccountId,
      paymentIntentId: r.source?.stripePaymentIntentId ?? null,
      amountCents: r.amount,
    });
    await db.payment.create({
      data: {
        venueId: booking.venueId,
        bookingId,
        type: r.type,
        status: "SUCCEEDED",
        amountCents: r.amount,
        currency: booking.venue.currency,
        stripeRefundId,
        reason: `Cancellation: ${reason}`,
      },
    });
  }

  await db.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
  });

  if (booking.client.email) {
    const email = cancellationEmail(brandOf(booking.venue), summaryOf(booking), refundCents + security, refundPct);
    await sendEmail({ to: booking.client.email, ...email, replyTo: booking.venue.email ?? undefined });
  }

  return { refundCents, refundPct, securityRefundCents: security };
}

// ---------------------------------------------------------------------------
// Post-event security deposit settlement
// ---------------------------------------------------------------------------

export async function settleSecurityDeposit(
  bookingId: string,
  deductions: SecurityDeduction[]
): Promise<{ refundCents: number; deductedCents: number }> {
  const booking = await getFullBooking(bookingId);
  const payments = await db.payment.findMany({ where: { bookingId } });
  const held = securityHeld(payments);
  if (held <= 0) return { refundCents: 0, deductedCents: 0 };

  const { refundCents, deductedCents } = computeSecurityRefund(held, deductions);
  const source = payments.find((p) => p.status === "SUCCEEDED" && p.type === "SECURITY_DEPOSIT");

  if (refundCents > 0) {
    const stripeRefundId = await refundStripePayment({
      venueStripeAccountId: booking.venue.stripeAccountId,
      paymentIntentId: source?.stripePaymentIntentId ?? null,
      amountCents: refundCents,
    });
    await db.payment.create({
      data: {
        venueId: booking.venueId,
        bookingId,
        type: "SECURITY_REFUND",
        status: "SUCCEEDED",
        amountCents: refundCents,
        currency: booking.venue.currency,
        stripeRefundId,
        reason: deductions.map((d) => `${d.reason}: ${formatMoney(d.amountCents, booking.venue.currency)}`).join("; ") || "Full refund — no deductions",
      },
    });
  } else if (deductedCents > 0) {
    await db.payment.create({
      data: {
        venueId: booking.venueId,
        bookingId,
        type: "SECURITY_REFUND",
        status: "SUCCEEDED",
        amountCents: 0,
        currency: booking.venue.currency,
        reason: `Fully deducted: ${deductions.map((d) => d.reason).join("; ")}`,
      },
    });
  }

  if (booking.client.email) {
    const email = securityRefundEmail(brandOf(booking.venue), summaryOf(booking), refundCents, deductions);
    await sendEmail({ to: booking.client.email, ...email, replyTo: booking.venue.email ?? undefined });
  }

  return { refundCents, deductedCents };
}

// ---------------------------------------------------------------------------
// Scheduled email automation (called by /api/cron/daily)
// ---------------------------------------------------------------------------

export async function sendBalanceReminders(reminderDays = [14, 3]): Promise<number> {
  let sent = 0;
  const bookings = await db.booking.findMany({
    where: { status: "CONFIRMED", balanceDueDate: { not: null }, start: { gt: new Date() } },
    include: { client: true, space: true, venue: true, payments: true },
  });
  for (const b of bookings) {
    if (!b.client.email || !b.balanceDueDate) continue;
    const paid = paidTowardsBooking(b.payments);
    const due = b.totalCents - paid;
    if (due <= 0) continue;
    const daysToDue = calendarDaysUntil(new Date(), b.balanceDueDate, b.venue.timezone);
    if (!reminderDays.includes(daysToDue)) continue;
    const email = balanceReminderEmail(
      brandOf(b.venue),
      summaryOf(b),
      due,
      `${appUrl()}/b/${b.manageToken}?pay=balance`
    );
    await sendEmail({ to: b.client.email, ...email, replyTo: b.venue.email ?? undefined });
    sent++;
  }
  return sent;
}

export async function sendEventWeekEmails(): Promise<number> {
  let sent = 0;
  const bookings = await db.booking.findMany({
    where: { status: "CONFIRMED", start: { gt: new Date() } },
    include: { client: true, space: true, venue: true },
  });
  for (const b of bookings) {
    if (!b.client.email) continue;
    const days = calendarDaysUntil(new Date(), b.start, b.venue.timezone);
    if (days !== 5) continue; // one logistics email, 5 days out
    const brand = brandOf(b.venue);
    const logistics = `
      <p><strong>Access from:</strong> ${formatAccessTime(b)} (includes your ${b.setupBufferMins}-min setup window)</p>
      ${b.venue.houseRules ? `<p><strong>House rules:</strong> ${b.venue.houseRules}</p>` : ""}
      <p><strong>Questions?</strong> ${b.venue.phone ?? b.venue.email ?? "Contact us via your booking page."}</p>`;
    const { eventWeekEmail } = await import("./email-templates");
    const email = eventWeekEmail(brand, summaryOf(b), logistics);
    await sendEmail({ to: b.client.email, ...email, replyTo: b.venue.email ?? undefined });
    sent++;
  }
  return sent;
}

function formatAccessTime(b: FullBooking): string {
  const access = new Date(b.start.getTime() - b.setupBufferMins * 60_000);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: b.venue.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(access);
}

/** Mark past confirmed bookings COMPLETED and thank the client. */
export async function completePastBookings(): Promise<number> {
  const bookings = await db.booking.findMany({
    where: { status: "CONFIRMED", end: { lt: new Date() } },
    include: { client: true, space: true, venue: true, payments: true },
  });
  for (const b of bookings) {
    await db.booking.update({ where: { id: b.id }, data: { status: "COMPLETED" } });
    if (b.client.email) {
      const held = securityHeld(b.payments);
      const notice =
        held > 0
          ? `<p>Your refundable security deposit of <strong>${formatMoney(held, b.venue.currency)}</strong> will be reviewed and refunded within 7 days.</p>`
          : "";
      const { thankYouEmail } = await import("./email-templates");
      const email = thankYouEmail(brandOf(b.venue), summaryOf(b), notice);
      await sendEmail({ to: b.client.email, ...email, replyTo: b.venue.email ?? undefined });
    }
  }
  return bookings.length;
}
