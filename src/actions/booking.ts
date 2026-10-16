"use server";

// Owner-side booking operations: the fast phone-booking form, pencil holds,
// quotes, confirmations with deposit links, drag-reschedule with repricing,
// cancellation, manual payments, and security-deposit settlement.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  checkSlot,
  blockingWhere,
  createBooking,
  rescheduleBooking,
  transitionBooking,
  type CreateBookingResult,
} from "@/lib/booking";
import {
  priceSelection,
  resolveAddOns,
  upsertClient,
  type SpaceWithRates,
} from "@/lib/booking-helpers";
import { sendEmail } from "@/lib/email";
import { inquiryAckEmail } from "@/lib/email-templates";
import {
  brandOf,
  cancelBookingWithRefund,
  getFullBooking,
  settleSecurityDeposit,
  startBalancePayment,
  startDepositPayment,
  summaryOf,
} from "@/lib/payments";
import { assertVenueRow, requireVenue } from "@/lib/tenancy";
import { addDays, venueDateStr, venueLocalToUtc } from "@/lib/time";
import { phoneBookingSchema, securitySettlementSchema } from "@/lib/validators";
import { createQuoteForBooking } from "@/lib/quotes";

async function spaceWithRates(spaceId: string): Promise<SpaceWithRates> {
  return db.space.findUniqueOrThrow({
    where: { id: spaceId },
    include: { ratePlan: { include: { peakPeriods: true } } },
  });
}

export type PhoneBookingResult =
  | { ok: true; bookingId: string; depositUrl?: string; totalCents: number; depositCents: number; currency: string; holdUntil: string | null }
  | { ok: false; error: string; alternatives?: { spaces: { id: string; name: string }[]; dates: string[] } };

/** Read-only preview; the create action checks availability again inside its transaction. */
export async function previewPhoneBookingAction(slug: string, input: unknown) {
  const { venue } = await requireVenue(slug, "MANAGER");
  const parsed = phoneBookingSchema.pick({ spaceId: true, eventType: true, slotType: true, date: true, startTime: true, endTime: true, endsNextDay: true }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Choose a valid date and time." };
  if (!parsed.data.endsNextDay && parsed.data.endTime <= parsed.data.startTime) return { ok: false as const, error: "End time must be after start. Select Ends next day for an overnight event." };
  const space = await assertVenueRow(await spaceWithRates(parsed.data.spaceId), venue.id);
  if (!space.ratePlan) return { ok: false as const, error: "Set up rates for this space first." };
  try {
    const priced = priceSelection(venue, space, parsed.data, []);
    const available = await checkSlot(space.id, priced.start, priced.end, space.setupBufferMins, space.teardownBufferMins);
    return { ok: true as const, available, totalCents: priced.quote.totalCents, depositCents: priced.depositCents, currency: venue.currency };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not check this window." };
  }
}

/** The under-45-seconds phone booking form. */
export async function createPhoneBookingAction(
  slug: string,
  input: unknown
): Promise<PhoneBookingResult> {
  const { venue } = await requireVenue(slug, "MANAGER");
  const parsed = phoneBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!d.endsNextDay && d.endTime <= d.startTime) return { ok: false, error: "End time must be after start. Select Ends next day for an overnight event." };

  const space = await assertVenueRow(await spaceWithRates(d.spaceId), venue.id);
  if (!space.ratePlan) return { ok: false, error: "Set up rates for this space first" };

  const addOns = await resolveAddOns(venue.id, d.addOns);
  let priced;
  try {
    priced = priceSelection(venue, space, d, addOns);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Pricing failed" };
  }

  const client = await upsertClient(venue.id, {
    name: d.clientName,
    phone: d.clientPhone,
    email: d.clientEmail || null,
  });

  const statusMap = {
    INQUIRY: "INQUIRY",
    QUOTE: "QUOTE_SENT",
    PENCIL: "PENCILED",
    CONFIRM: "CONFIRMED",
  } as const;

  const holdUntil = d.action === "PENCIL" ? addDays(new Date(), d.pencilDays) : null;
  const result = await createBooking({
    venueId: venue.id,
    spaceId: space.id,
    clientId: client.id,
    status: statusMap[d.action],
    source: "PHONE",
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
    holdExpiresAt: holdUntil,
    notes: d.notes || null,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: "That slot was just taken.",
      alternatives: {
        spaces: result.alternatives.spaces.map((s) => ({ id: s.id, name: s.name })),
        dates: result.alternatives.dates.map((dt) => dt.toISOString()),
      },
    };
  }

  let depositUrl: string | undefined;
  if (d.action === "QUOTE") {
    await createQuoteForBooking(result.bookingId, { send: true });
  } else if (d.action === "CONFIRM") {
    // "Confirm with deposit link": booking blocks immediately; the client
    // pays through the link. Owners can also record a manual payment.
    depositUrl = await startDepositPayment(result.bookingId);
  }

  revalidatePath(`/app/${slug}/calendar`);
  return { ok: true, bookingId: result.bookingId, depositUrl, totalCents: priced.quote.totalCents, depositCents: priced.depositCents, currency: venue.currency, holdUntil: holdUntil?.toISOString() ?? null };
}

export async function pencilHoldAction(slug: string, bookingId: string, days: number) {
  const { venue } = await requireVenue(slug, "MANAGER");
  await assertVenueRow(await db.booking.findUnique({ where: { id: bookingId } }), venue.id);
  const res = await transitionBooking(bookingId, "PENCILED", {
    holdExpiresAt: addDays(new Date(), Math.min(Math.max(days, 1), 30)),
  });
  revalidatePath(`/app/${slug}/calendar`);
  if (!res.ok) return { ok: false as const, error: "That slot is already blocked by another booking." };
  return { ok: true as const };
}

export async function sendQuoteAction(slug: string, bookingId: string) {
  const { venue } = await requireVenue(slug, "MANAGER");
  await assertVenueRow(await db.booking.findUnique({ where: { id: bookingId } }), venue.id);
  await createQuoteForBooking(bookingId, { send: true });
  revalidatePath(`/app/${slug}/bookings/${bookingId}`);
  return { ok: true as const };
}

export async function confirmWithDepositLinkAction(slug: string, bookingId: string) {
  const { venue } = await requireVenue(slug, "MANAGER");
  const booking = await assertVenueRow(
    await db.booking.findUnique({ where: { id: bookingId } }),
    venue.id
  );
  // Block the slot now (PENCILED for 7 days) so it can't be sniped while
  // the client pays; deposit payment flips it to CONFIRMED.
  if (booking.status === "INQUIRY" || booking.status === "QUOTE_SENT") {
    const res = await transitionBooking(bookingId, "PENCILED", {
      holdExpiresAt: addDays(new Date(), 7),
    });
    if (!res.ok) return { ok: false as const, error: "Slot already taken" };
  }
  const url = await startDepositPayment(bookingId);
  revalidatePath(`/app/${slug}/bookings/${bookingId}`);
  return { ok: true as const, depositUrl: url };
}

/** Owner records an offline payment (cash / bank transfer). */
export async function recordManualPaymentAction(
  slug: string,
  bookingId: string,
  type: "BOOKING_DEPOSIT" | "BALANCE" | "SECURITY_DEPOSIT",
  amountCents: number,
  details?: { date: string; method: string; note: string }
) {
  const { venue } = await requireVenue(slug, "MANAGER");
  const booking = await assertVenueRow(
    await db.booking.findUnique({ where: { id: bookingId } }),
    venue.id
  );
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false as const, error: "Enter a valid amount" };
  }
  if (!["BOOKING_DEPOSIT", "BALANCE", "SECURITY_DEPOSIT"].includes(type)) return { ok: false as const, error: "Choose a valid payment type." };
  let receivedAt: Date | undefined;
  if (details) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(details.date) || !["Bank transfer", "Cash", "Card", "Other"].includes(details.method) || details.note.length > 1000) return { ok: false as const, error: "Review the payment date, method, and note." };
    if (details.date > venueDateStr(new Date(), venue.timezone)) return { ok: false as const, error: "Payment date cannot be in the future." };
    receivedAt = venueLocalToUtc(venue.timezone, details.date, "12:00");
  }
  await db.payment.create({
    data: {
      venueId: venue.id,
      bookingId,
      type,
      status: "SUCCEEDED",
      amountCents,
      currency: venue.currency,
      reason: details ? `${details.method}${details.note.trim() ? ` · ${details.note.trim()}` : ""}` : "Recorded manually by venue",
      ...(receivedAt ? { createdAt: receivedAt } : {}),
    },
  });
  const depositPaid = await db.payment.aggregate({ where: { venueId: venue.id, bookingId, status: "SUCCEEDED", type: { in: ["BOOKING_DEPOSIT", "BALANCE"] } }, _sum: { amountCents: true } });
  if (type === "BOOKING_DEPOSIT" && ["INQUIRY", "QUOTE_SENT", "PENCILED", "HOLD"].includes(booking.status) && (depositPaid._sum.amountCents ?? 0) >= booking.depositCents) {
    const res = await transitionBooking(bookingId, "CONFIRMED", { holdExpiresAt: null });
    if (!res.ok) return { ok: false as const, error: "Payment recorded, but the slot is blocked by another booking!" };
  }
  revalidatePath(`/app/${slug}/bookings/${bookingId}`);
  revalidatePath(`/app/${slug}/calendar`);
  return { ok: true as const };
}

export interface ReschedulePreview {
  ok: boolean;
  error?: string;
  oldTotalCents?: number;
  newTotalCents?: number;
  priceChanged?: boolean;
  depositCents?: number;
  available?: boolean;
  conflict?: { name: string; space: string; start: string; end: string; blockedStart: string };
  alternatives?: { spaceId: string; name: string; date: string; startTime: string; endTime: string; endsNextDay: boolean }[];
}

/** Step 1 of calendar drag: validate + reprice, ask for confirmation. */
export async function previewRescheduleAction(
  slug: string,
  bookingId: string,
  target: { spaceId: string; date: string; startTime: string; endTime: string; endsNextDay?: boolean }
): Promise<ReschedulePreview> {
  const { venue } = await requireVenue(slug, "MANAGER");
  const booking = await assertVenueRow(
    await db.booking.findUnique({ where: { id: bookingId } }),
    venue.id
  );
  const space = await assertVenueRow(await spaceWithRates(target.spaceId), venue.id);
  if (!space.ratePlan) return { ok: false, error: "Target space has no rates" };
  try {
    const priced = priceSelection(
      venue,
      space,
      { ...target, endsNextDay: target.endsNextDay ?? false, slotType: booking.slotType },
      [] // add-ons carry over at their snapshotted prices
    );
    const addOnCents = (booking.lineItems as { kind: string; totalCents: number }[])
      .filter((li) => li.kind === "ADDON")
      .reduce((s, li) => s + li.totalCents, 0);
    const subtotal = priced.quote.subtotalCents + addOnCents;
    const newTotal = subtotal + Math.round(subtotal * venue.taxBps / 10_000);
    const blockedStart = new Date(priced.start.getTime() - space.setupBufferMins * 60000);
    const blockedEnd = new Date(priced.end.getTime() + space.teardownBufferMins * 60000);
    const clash = await db.booking.findFirst({
      where: { venueId: venue.id, spaceId: space.id, id: { not: bookingId }, blockedStart: { lt: blockedEnd }, blockedEnd: { gt: blockedStart }, ...blockingWhere() },
      include: { client: { select: { name: true } }, space: { select: { name: true } } },
    });
    const alternatives: NonNullable<ReschedulePreview["alternatives"]> = [];
    const capacity = Math.max(space.seatedCapacity, space.standingCapacity);
    const fitsCapacity = capacity === 0 || booking.guestCount <= capacity;
    if (clash || !fitsCapacity) {
      const others = await db.space.findMany({ where: { venueId: venue.id, active: true, id: { not: space.id }, OR: [{ seatedCapacity: { gte: booking.guestCount } }, { standingCapacity: { gte: booking.guestCount } }] }, orderBy: { sortOrder: "asc" } });
      for (const other of others) {
        if (await checkSlot(other.id, priced.start, priced.end, other.setupBufferMins, other.teardownBufferMins, bookingId)) alternatives.push({ ...target, endsNextDay: target.endsNextDay ?? false, spaceId: other.id, name: other.name });
        if (alternatives.length >= 3) break;
      }
      for (let day = 1; fitsCapacity && day <= 7 && alternatives.length < 3; day++) {
        const date = venueDateStr(addDays(priced.start, day), venue.timezone);
        const next = priceSelection(venue, space, { ...target, date, endsNextDay: target.endsNextDay ?? false, slotType: booking.slotType }, []);
        if (await checkSlot(space.id, next.start, next.end, space.setupBufferMins, space.teardownBufferMins, bookingId)) alternatives.push({ ...target, endsNextDay: target.endsNextDay ?? false, date, spaceId: space.id, name: space.name });
      }
    }
    return {
      ok: true, available: !clash && fitsCapacity,
      error: !fitsCapacity ? `Guest count exceeds ${space.name} capacity of ${capacity}.` : undefined,
      oldTotalCents: booking.totalCents, newTotalCents: newTotal,
      depositCents: booking.depositCents,
      priceChanged: newTotal !== booking.totalCents,
      conflict: clash ? { name: clash.client.name, space: clash.space.name, start: clash.start.toISOString(), end: clash.end.toISOString(), blockedStart: clash.blockedStart.toISOString() } : undefined,
      alternatives,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not price the new slot" };
  }
}

/** Step 2 of calendar drag: actually move (owner confirmed price change). */
export async function applyRescheduleAction(
  slug: string,
  bookingId: string,
  target: { spaceId: string; date: string; startTime: string; endTime: string; endsNextDay?: boolean },
  expectedTotalCents?: number
) {
  const { venue } = await requireVenue(slug, "MANAGER");
  const booking = await assertVenueRow(
    await db.booking.findUnique({ where: { id: bookingId } }),
    venue.id
  );
  const space = await assertVenueRow(await spaceWithRates(target.spaceId), venue.id);
  if (!space.ratePlan) return { ok: false as const, error: "Target space has no rates" };

  const capacity = Math.max(space.seatedCapacity, space.standingCapacity);
  if (capacity > 0 && booking.guestCount > capacity) return { ok: false as const, error: `Guest count exceeds ${space.name} capacity of ${capacity}.` };

  const oldItems = booking.lineItems as { kind: string; label: string; qty: number; unitCents: number; totalCents: number }[];
  const addOnItems = oldItems.filter((li) => li.kind === "ADDON");

  const priced = priceSelection(
    venue,
    space,
    { ...target, endsNextDay: target.endsNextDay ?? false, slotType: booking.slotType },
    []
  );
  const lineItems = [...priced.quote.lineItems, ...addOnItems];
  const subtotal = lineItems.reduce((s, li) => s + li.totalCents, 0);
  const tax = Math.round((subtotal * venue.taxBps) / 10_000);

  if (expectedTotalCents !== undefined && expectedTotalCents !== subtotal + tax) return { ok: false as const, error: "The price changed while you were reviewing. Check the updated quote before confirming." };

  const res: CreateBookingResult = await rescheduleBooking(bookingId, {
    spaceId: space.id,
    start: priced.start,
    end: priced.end,
    setupBufferMins: space.setupBufferMins,
    teardownBufferMins: space.teardownBufferMins,
    lineItems,
    subtotalCents: subtotal,
    taxCents: tax,
    totalCents: subtotal + tax,
  });

  revalidatePath(`/app/${slug}/calendar`);
  if (!res.ok) {
    return {
      ok: false as const,
      error: "That slot is taken.",
      alternatives: res.alternatives.spaces.map((s) => s.name),
    };
  }
  return { ok: true as const, totalCents: subtotal + tax };
}

export async function cancelBookingAction(slug: string, bookingId: string, reason: string) {
  const { venue } = await requireVenue(slug, "MANAGER");
  await assertVenueRow(await db.booking.findUnique({ where: { id: bookingId } }), venue.id);
  const result = await cancelBookingWithRefund(bookingId, reason || "Cancelled by venue");
  revalidatePath(`/app/${slug}/calendar`);
  revalidatePath(`/app/${slug}/bookings/${bookingId}`);
  return { ok: true as const, ...result };
}

export async function markNoShowAction(slug: string, bookingId: string) {
  const { venue } = await requireVenue(slug, "MANAGER");
  await assertVenueRow(await db.booking.findUnique({ where: { id: bookingId } }), venue.id);
  await db.booking.update({ where: { id: bookingId }, data: { status: "NO_SHOW" } });
  revalidatePath(`/app/${slug}/bookings/${bookingId}`);
  return { ok: true as const };
}

export async function toggleChecklistAction(
  slug: string,
  bookingId: string,
  field: "setupDone" | "eventDone",
  value: boolean
) {
  const { venue } = await requireVenue(slug); // STAFF may do this
  await assertVenueRow(await db.booking.findUnique({ where: { id: bookingId } }), venue.id);
  await db.booking.update({ where: { id: bookingId }, data: { [field]: value } });
  revalidatePath(`/app/${slug}`);
  return { ok: true as const };
}

export async function settleSecurityDepositAction(slug: string, bookingId: string, input: unknown) {
  const { venue } = await requireVenue(slug, "MANAGER");
  await assertVenueRow(await db.booking.findUnique({ where: { id: bookingId } }), venue.id);
  const parsed = securitySettlementSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const result = await settleSecurityDeposit(bookingId, parsed.data.deductions);
  revalidatePath(`/app/${slug}/bookings/${bookingId}`);
  return { ok: true as const, ...result };
}

export async function sendBalanceLinkAction(slug: string, bookingId: string) {
  const { venue } = await requireVenue(slug, "MANAGER");
  await assertVenueRow(await db.booking.findUnique({ where: { id: bookingId } }), venue.id);
  const booking = await getFullBooking(bookingId);
  const url = await startBalancePayment(bookingId);
  if (booking.client.email) {
    const brand = brandOf(booking.venue);
    const { balanceReminderEmail } = await import("@/lib/email-templates");
    const payments = await db.payment.findMany({ where: { bookingId } });
    const paid = payments
      .filter((p) => p.status === "SUCCEEDED" && (p.type === "BOOKING_DEPOSIT" || p.type === "BALANCE"))
      .reduce((s, p) => s + p.amountCents, 0);
    const email = balanceReminderEmail(brand, summaryOf(booking), booking.totalCents - paid, url);
    await sendEmail({ to: booking.client.email, ...email, replyTo: booking.venue.email ?? undefined });
  }
  return { ok: true as const, url };
}

export async function sendInquiryAckAction(bookingId: string) {
  const booking = await getFullBooking(bookingId);
  if (!booking.client.email) return;
  const email = inquiryAckEmail(brandOf(booking.venue), summaryOf(booking));
  await sendEmail({ to: booking.client.email, ...email, replyTo: booking.venue.email ?? undefined });
}
