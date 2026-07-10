// Booking engine. Availability is computed from bookings — there is no
// separate calendar to drift. The Postgres exclusion constraint
// (booking_no_double_booking) is the final arbiter; everything here is
// UX on top of it: hold expiry, friendly conflict errors, alternatives.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { BookingStatus } from "@/generated/prisma/enums";
import { db } from "./db";
import { addDays, addMinutes, overlaps } from "./time";

export const BLOCKING_STATUSES: BookingStatus[] = [
  BookingStatus.HOLD,
  BookingStatus.PENCILED,
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];

export const ONLINE_HOLD_MINUTES = 15;

type Tx = Prisma.TransactionClient | PrismaClient;

/** Blocked interval = event time expanded by setup/teardown buffers. */
export function blockedInterval(
  start: Date,
  end: Date,
  setupBufferMins: number,
  teardownBufferMins: number
): { blockedStart: Date; blockedEnd: Date } {
  return {
    blockedStart: addMinutes(start, -setupBufferMins),
    blockedEnd: addMinutes(end, teardownBufferMins),
  };
}

/** Did Postgres reject this write via the exclusion constraint? */
export function isOverlapError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? `${err.message} ${JSON.stringify((err as { meta?: unknown }).meta ?? "")}`
      : String(err);
  return msg.includes("booking_no_double_booking") || msg.includes("23P01");
}

function isSerializationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("40001") ||
    msg.includes("could not serialize") ||
    (err as { code?: string })?.code === "P2034"
  );
}

/**
 * Flip expired HOLD / PENCILED rows to EXPIRED so their slots free up.
 * Runs inside every booking write and every availability read path.
 */
export async function releaseExpiredHolds(tx: Tx, spaceId?: string) {
  await tx.booking.updateMany({
    where: {
      ...(spaceId ? { spaceId } : {}),
      status: { in: [BookingStatus.HOLD, BookingStatus.PENCILED] },
      holdExpiresAt: { lt: new Date() },
    },
    data: { status: BookingStatus.EXPIRED },
  });
}

/** Prisma `where` fragment matching bookings that currently block a slot. */
export function blockingWhere(now = new Date()): Prisma.BookingWhereInput {
  return {
    OR: [
      {
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW],
        },
      },
      {
        status: { in: [BookingStatus.HOLD, BookingStatus.PENCILED] },
        holdExpiresAt: { gte: now },
      },
    ],
  };
}

/** Read-side availability check (the DB constraint still has final say). */
export async function isSpaceFree(
  tx: Tx,
  spaceId: string,
  blockedStart: Date,
  blockedEnd: Date,
  excludeBookingId?: string
): Promise<boolean> {
  const clash = await tx.booking.findFirst({
    where: {
      spaceId,
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      blockedStart: { lt: blockedEnd },
      blockedEnd: { gt: blockedStart },
      ...blockingWhere(),
    },
    select: { id: true },
  });
  return clash == null;
}

export interface BookingSlotInput {
  venueId: string;
  spaceId: string;
  clientId: string;
  status: BookingStatus;
  source: "ONLINE" | "PHONE" | "WHATSAPP" | "WALK_IN";
  eventType:
    | "WEDDING"
    | "BIRTHDAY"
    | "CONFERENCE"
    | "CHURCH_PROGRAM"
    | "CORPORATE"
    | "OTHER";
  slotType: "HOURLY" | "HALF_DAY" | "FULL_DAY" | "EVENING";
  start: Date;
  end: Date;
  setupBufferMins: number;
  teardownBufferMins: number;
  guestCount: number;
  layout?: string | null;
  lineItems: unknown[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  securityDepositCents: number;
  balanceDueDate?: Date | null;
  holdExpiresAt?: Date | null;
  notes?: string | null;
}

export interface AlternativeSuggestions {
  /** Other spaces at this venue free for the same interval. */
  spaces: { id: string; name: string; seatedCapacity: number }[];
  /** Next dates (same time, same space) that are free. */
  dates: Date[];
}

export type CreateBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: "SLOT_TAKEN"; alternatives: AlternativeSuggestions };

/**
 * Create a booking. Blocking statuses go through a serializable transaction
 * (retried on serialization failures); an exclusion-constraint violation is
 * translated into "slot just taken" plus alternative spaces/dates.
 */
export async function createBooking(
  input: BookingSlotInput
): Promise<CreateBookingResult> {
  const blocks = BLOCKING_STATUSES.includes(input.status);
  if (
    (input.status === BookingStatus.HOLD || input.status === BookingStatus.PENCILED) &&
    !input.holdExpiresAt
  ) {
    throw new Error(`${input.status} bookings require holdExpiresAt`);
  }
  const { blockedStart, blockedEnd } = blockedInterval(
    input.start,
    input.end,
    input.setupBufferMins,
    input.teardownBufferMins
  );

  const data: Prisma.BookingUncheckedCreateInput = {
    venueId: input.venueId,
    spaceId: input.spaceId,
    clientId: input.clientId,
    status: input.status,
    source: input.source,
    eventType: input.eventType,
    slotType: input.slotType,
    start: input.start,
    end: input.end,
    setupBufferMins: input.setupBufferMins,
    teardownBufferMins: input.teardownBufferMins,
    blockedStart,
    blockedEnd,
    guestCount: input.guestCount,
    layout: input.layout ?? null,
    lineItems: input.lineItems as Prisma.InputJsonValue,
    subtotalCents: input.subtotalCents,
    taxCents: input.taxCents,
    totalCents: input.totalCents,
    depositCents: input.depositCents,
    securityDepositCents: input.securityDepositCents,
    balanceDueDate: input.balanceDueDate ?? null,
    holdExpiresAt: input.holdExpiresAt ?? null,
    notes: input.notes ?? null,
  };

  if (!blocks) {
    // Inquiries/quotes never contend for the slot — plain insert.
    const b = await db.booking.create({ data, select: { id: true } });
    return { ok: true, bookingId: b.id };
  }

  try {
    const booking = await withSerializableRetry(async () =>
      db.$transaction(
        async (tx) => {
          await releaseExpiredHolds(tx, input.spaceId);
          return tx.booking.create({ data, select: { id: true } });
        },
        { isolationLevel: "Serializable" }
      )
    );
    return { ok: true, bookingId: booking.id };
  } catch (err) {
    if (isOverlapError(err)) {
      return {
        ok: false,
        reason: "SLOT_TAKEN",
        alternatives: await suggestAlternatives(
          input.venueId,
          input.spaceId,
          blockedStart,
          blockedEnd,
          input.guestCount
        ),
      };
    }
    throw err;
  }
}

async function withSerializableRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (isSerializationError(err)) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Promote a booking into a blocking status (e.g. INQUIRY → PENCILED,
 * HOLD → CONFIRMED). The exclusion constraint fires on UPDATE too, so a
 * promotion into an already-taken slot fails safely.
 */
export async function transitionBooking(
  bookingId: string,
  toStatus: BookingStatus,
  extra: Prisma.BookingUncheckedUpdateInput = {}
): Promise<CreateBookingResult> {
  try {
    await withSerializableRetry(async () =>
      db.$transaction(
        async (tx) => {
          const existing = await tx.booking.findUniqueOrThrow({
            where: { id: bookingId },
            select: { spaceId: true },
          });
          await releaseExpiredHolds(tx, existing.spaceId);
          await tx.booking.update({
            where: { id: bookingId },
            data: { status: toStatus, ...extra },
          });
        },
        { isolationLevel: "Serializable" }
      )
    );
    return { ok: true, bookingId };
  } catch (err) {
    if (isOverlapError(err)) {
      const existing = await db.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: {
          spaceId: true,
          venueId: true,
          blockedStart: true,
          blockedEnd: true,
          guestCount: true,
        },
      });
      return {
        ok: false,
        reason: "SLOT_TAKEN",
        alternatives: await suggestAlternatives(
          existing.venueId,
          existing.spaceId,
          existing.blockedStart,
          existing.blockedEnd,
          existing.guestCount
        ),
      };
    }
    throw err;
  }
}

/**
 * Move a booking to a new slot and/or space (calendar drag). New buffers and
 * pricing are supplied by the caller after re-pricing confirmation.
 */
export async function rescheduleBooking(
  bookingId: string,
  next: {
    spaceId: string;
    start: Date;
    end: Date;
    setupBufferMins: number;
    teardownBufferMins: number;
    lineItems?: unknown[];
    subtotalCents?: number;
    taxCents?: number;
    totalCents?: number;
    depositCents?: number;
  }
): Promise<CreateBookingResult> {
  const { blockedStart, blockedEnd } = blockedInterval(
    next.start,
    next.end,
    next.setupBufferMins,
    next.teardownBufferMins
  );
  try {
    await withSerializableRetry(async () =>
      db.$transaction(
        async (tx) => {
          await releaseExpiredHolds(tx, next.spaceId);
          await tx.booking.update({
            where: { id: bookingId },
            data: {
              spaceId: next.spaceId,
              start: next.start,
              end: next.end,
              setupBufferMins: next.setupBufferMins,
              teardownBufferMins: next.teardownBufferMins,
              blockedStart,
              blockedEnd,
              ...(next.lineItems !== undefined
                ? { lineItems: next.lineItems as Prisma.InputJsonValue }
                : {}),
              ...(next.subtotalCents !== undefined
                ? { subtotalCents: next.subtotalCents }
                : {}),
              ...(next.taxCents !== undefined ? { taxCents: next.taxCents } : {}),
              ...(next.totalCents !== undefined ? { totalCents: next.totalCents } : {}),
              ...(next.depositCents !== undefined
                ? { depositCents: next.depositCents }
                : {}),
            },
          });
        },
        { isolationLevel: "Serializable" }
      )
    );
    return { ok: true, bookingId };
  } catch (err) {
    if (isOverlapError(err)) {
      const existing = await db.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: { venueId: true, guestCount: true },
      });
      return {
        ok: false,
        reason: "SLOT_TAKEN",
        alternatives: await suggestAlternatives(
          existing.venueId,
          next.spaceId,
          blockedStart,
          blockedEnd,
          existing.guestCount
        ),
      };
    }
    throw err;
  }
}

/** "Slot just taken — here are alternative dates/spaces." */
export async function suggestAlternatives(
  venueId: string,
  spaceId: string,
  blockedStart: Date,
  blockedEnd: Date,
  guestCount: number
): Promise<AlternativeSuggestions> {
  const otherSpaces = await db.space.findMany({
    where: {
      venueId,
      active: true,
      id: { not: spaceId },
      OR: [
        { seatedCapacity: { gte: guestCount } },
        { standingCapacity: { gte: guestCount } },
      ],
    },
    select: { id: true, name: true, seatedCapacity: true },
    orderBy: { sortOrder: "asc" },
  });

  const freeSpaces: AlternativeSuggestions["spaces"] = [];
  for (const s of otherSpaces) {
    if (await isSpaceFree(db, s.id, blockedStart, blockedEnd)) freeSpaces.push(s);
    if (freeSpaces.length >= 3) break;
  }

  // Same slot on subsequent weeks (same weekday & time), next 8 weeks.
  const dates: Date[] = [];
  for (let week = 1; week <= 8 && dates.length < 3; week++) {
    const s = addDays(blockedStart, 7 * week);
    const e = addDays(blockedEnd, 7 * week);
    if (await isSpaceFree(db, spaceId, s, e)) dates.push(s);
  }

  return { spaces: freeSpaces, dates };
}

// ---------------------------------------------------------------------------
// Availability reads (calendar + public free/busy)
// ---------------------------------------------------------------------------

export interface BusyInterval {
  bookingId: string;
  spaceId: string;
  blockedStart: Date;
  blockedEnd: Date;
  start: Date;
  end: Date;
  status: BookingStatus;
}

/** All blocking intervals for a venue in [from, to). Free/busy only. */
export async function busyIntervals(
  venueId: string,
  from: Date,
  to: Date,
  spaceId?: string
): Promise<BusyInterval[]> {
  const rows = await db.booking.findMany({
    where: {
      venueId,
      ...(spaceId ? { spaceId } : {}),
      blockedStart: { lt: to },
      blockedEnd: { gt: from },
      ...blockingWhere(),
    },
    select: {
      id: true,
      spaceId: true,
      blockedStart: true,
      blockedEnd: true,
      start: true,
      end: true,
      status: true,
    },
    orderBy: { blockedStart: "asc" },
  });
  return rows.map(({ id, ...r }) => ({ bookingId: id, ...r }));
}

/** Convenience: does [start,end) + buffers fit in this space right now? */
export async function checkSlot(
  spaceId: string,
  start: Date,
  end: Date,
  setupBufferMins: number,
  teardownBufferMins: number,
  excludeBookingId?: string
): Promise<boolean> {
  const { blockedStart, blockedEnd } = blockedInterval(
    start,
    end,
    setupBufferMins,
    teardownBufferMins
  );
  return isSpaceFree(db, spaceId, blockedStart, blockedEnd, excludeBookingId);
}

export { overlaps };
