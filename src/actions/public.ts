"use server";

// Client-facing actions: availability lookup, live pricing, online booking
// (instant-book → 15-min HOLD + checkout; inquiry-first → INQUIRY + ack),
// manage-booking (pay balance / cancel per policy), tour requests.
// No client accounts — manage links are unguessable tokens.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  busyIntervals,
  createBooking,
  ONLINE_HOLD_MINUTES,
} from "@/lib/booking";
import {
  priceSelection,
  resolveAddOns,
  upsertClient,
} from "@/lib/booking-helpers";
import { sendEmail } from "@/lib/email";
import { inquiryAckEmail, tourRequestOwnerEmail } from "@/lib/email-templates";
import {
  brandOf,
  cancelBookingWithRefund,
  startBalancePayment,
  startDepositPayment,
  summaryOf,
} from "@/lib/payments";
import { computeCancellationRefund, type CancellationTier } from "@/lib/pricing";
import { paidTowardsBooking } from "@/lib/payments";
import { addMinutes, calendarDaysUntil, venueLocalToUtc } from "@/lib/time";
import { onlineBookingSchema, tourRequestSchema } from "@/lib/validators";

async function publishedVenue(slug: string) {
  const venue = await db.venue.findUnique({ where: { slug } });
  if (!venue || !venue.published) throw new Error("Venue not found");
  return venue;
}

/** Free/busy per space for a venue-local date (no client details leaked). */
export async function publicDayAvailability(slug: string, date: string) {
  const venue = await publishedVenue(slug);
  const dayStart = venueLocalToUtc(venue.timezone, date, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 36 * 3_600_000); // catch overnight tails
  const busy = await busyIntervals(venue.id, dayStart, dayEnd);
  return busy.map((b) => ({
    spaceId: b.spaceId,
    blockedStart: b.blockedStart.toISOString(),
    blockedEnd: b.blockedEnd.toISOString(),
  }));
}

/** Live price breakdown for the booking widget. */
export async function publicPriceQuote(
  slug: string,
  input: {
    spaceId: string;
    slotType: "HOURLY" | "HALF_DAY" | "FULL_DAY" | "EVENING";
    date: string;
    startTime: string;
    endTime: string;
    endsNextDay?: boolean;
    addOns: { addOnId: string; quantity: number }[];
  }
) {
  const venue = await publishedVenue(slug);
  const space = await db.space.findFirst({
    where: { id: input.spaceId, venueId: venue.id, active: true },
    include: { ratePlan: { include: { peakPeriods: true } } },
  });
  if (!space?.ratePlan) return { ok: false as const, error: "Space unavailable" };
  try {
    const addOns = await resolveAddOns(venue.id, input.addOns);
    const priced = priceSelection(
      venue,
      space,
      { ...input, endsNextDay: input.endsNextDay ?? false },
      addOns
    );
    const { checkSlot } = await import("@/lib/booking");
    const available = await checkSlot(
      space.id,
      priced.start,
      priced.end,
      space.setupBufferMins,
      space.teardownBufferMins
    );
    return {
      ok: true as const,
      available,
      instantBook: space.instantBook,
      lineItems: priced.quote.lineItems,
      subtotalCents: priced.quote.subtotalCents,
      taxCents: priced.quote.taxCents,
      totalCents: priced.quote.totalCents,
      depositCents: priced.depositCents,
      securityDepositCents: priced.securityDepositCents,
      balanceDueDate: priced.balanceDueDate.toISOString(),
    };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Could not price" };
  }
}

export type OnlineBookingResult =
  | { ok: true; mode: "checkout"; paymentUrl: string; manageToken: string }
  | { ok: true; mode: "inquiry"; manageToken: string }
  | { ok: false; error: string; alternatives?: { spaces: string[]; dates: string[] } };

export async function submitOnlineBookingAction(
  slug: string,
  input: unknown
): Promise<OnlineBookingResult> {
  const venue = await publishedVenue(slug);
  const parsed = onlineBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const space = await db.space.findFirst({
    where: { id: d.spaceId, venueId: venue.id, active: true },
    include: { ratePlan: { include: { peakPeriods: true } } },
  });
  if (!space?.ratePlan) return { ok: false, error: "This space is not available to book online." };

  const addOns = await resolveAddOns(venue.id, d.addOns);
  let priced;
  try {
    priced = priceSelection(venue, space, d, addOns);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Pricing failed" };
  }
  if (priced.start < new Date()) return { ok: false, error: "That date is in the past." };

  const client = await upsertClient(venue.id, {
    name: d.clientName,
    phone: d.clientPhone || null,
    email: d.clientEmail,
  });

  // Instant-book spaces take a 15-minute HOLD while the client pays;
  // inquiry-first spaces create a non-blocking INQUIRY for owner approval.
  const instant = space.instantBook;
  const result = await createBooking({
    venueId: venue.id,
    spaceId: space.id,
    clientId: client.id,
    status: instant ? "HOLD" : "INQUIRY",
    source: "ONLINE",
    eventType: d.eventType,
    slotType: d.slotType,
    start: priced.start,
    end: priced.end,
    setupBufferMins: space.setupBufferMins,
    teardownBufferMins: space.teardownBufferMins,
    guestCount: d.guestCount,
    lineItems: priced.quote.lineItems,
    subtotalCents: priced.quote.subtotalCents,
    taxCents: priced.quote.taxCents,
    totalCents: priced.quote.totalCents,
    depositCents: priced.depositCents,
    securityDepositCents: priced.securityDepositCents,
    balanceDueDate: priced.balanceDueDate,
    holdExpiresAt: instant ? addMinutes(new Date(), ONLINE_HOLD_MINUTES) : null,
    notes: d.notes || null,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: "Sorry — that slot was just booked. Here are some alternatives:",
      alternatives: {
        spaces: result.alternatives.spaces.map((s) => s.name),
        dates: result.alternatives.dates.map((dt) => dt.toISOString()),
      },
    };
  }

  const booking = await db.booking.findUniqueOrThrow({
    where: { id: result.bookingId },
    include: { client: true, space: true, venue: true },
  });

  if (instant) {
    const paymentUrl = await startDepositPayment(
      result.bookingId,
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/b/${booking.manageToken}?confirmed=1`
    );
    return { ok: true, mode: "checkout", paymentUrl, manageToken: booking.manageToken };
  }

  if (booking.client.email) {
    const email = inquiryAckEmail(brandOf(booking.venue), summaryOf(booking));
    await sendEmail({ to: booking.client.email, ...email, replyTo: venue.email ?? undefined });
  }
  return { ok: true, mode: "inquiry", manageToken: booking.manageToken };
}

// ---------------------------------------------------------------------------
// Manage-booking page (signed token — no account needed)
// ---------------------------------------------------------------------------

export async function payBalanceByTokenAction(token: string) {
  const booking = await db.booking.findUnique({ where: { manageToken: token } });
  if (!booking) return { ok: false as const, error: "Booking not found" };
  try {
    const url = await startBalancePayment(booking.id);
    return { ok: true as const, url };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Nothing due" };
  }
}

/** Preview the client's refund under the venue's tiered policy. */
export async function cancellationPreviewByToken(token: string) {
  const booking = await db.booking.findUnique({
    where: { manageToken: token },
    include: { venue: true, payments: true },
  });
  if (!booking) return { ok: false as const, error: "Booking not found" };
  const paid = paidTowardsBooking(booking.payments);
  const daysBefore = Math.max(
    0,
    calendarDaysUntil(new Date(), booking.start, booking.venue.timezone)
  );
  const { refundPct, refundCents } = computeCancellationRefund(
    paid,
    booking.venue.cancellationTiers as unknown as CancellationTier[],
    daysBefore
  );
  return { ok: true as const, paidCents: paid, daysBefore, refundPct, refundCents };
}

export async function cancelByTokenAction(token: string, reason: string) {
  const booking = await db.booking.findUnique({ where: { manageToken: token } });
  if (!booking) return { ok: false as const, error: "Booking not found" };
  if (booking.status === "CANCELLED") return { ok: false as const, error: "Already cancelled" };
  if (booking.start < new Date()) return { ok: false as const, error: "This event has already started" };
  const result = await cancelBookingWithRefund(booking.id, reason || "Cancelled by client");
  revalidatePath(`/b/${token}`);
  return { ok: true as const, ...result };
}

// ---------------------------------------------------------------------------
// Tour requests
// ---------------------------------------------------------------------------

export async function requestTourAction(slug: string, input: unknown) {
  const venue = await publishedVenue(slug);
  const parsed = tourRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const requestedAt = venueLocalToUtc(venue.timezone, d.date, d.time);
  if (requestedAt < new Date()) return { ok: false as const, error: "Pick a future time" };

  const tour = await db.tourRequest.create({
    data: {
      venueId: venue.id,
      spaceId: d.spaceId || null,
      name: d.name,
      email: d.email,
      phone: d.phone || null,
      requestedAt,
      notes: d.notes || null,
    },
  });

  if (venue.email) {
    const email = tourRequestOwnerEmail(
      brandOf(venue),
      { name: tour.name, email: tour.email, phone: tour.phone, requestedAt, notes: tour.notes },
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/app/${slug}/tours`
    );
    await sendEmail({ to: venue.email, ...email });
  }
  return { ok: true as const };
}
