// Integration tests against real Postgres — the exclusion constraint,
// buffers, hold expiry, and race conditions the spec calls out.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  blockedInterval,
  busyIntervals,
  checkSlot,
  createBooking,
  transitionBooking,
  rescheduleBooking,
  type BookingSlotInput,
} from "@/lib/booking";
import { venueLocalToUtc } from "@/lib/time";

const TZ = "America/New_York";

let venueId: string;
let hallId: string; // 60 min setup / 60 min teardown
let gardenId: string; // no buffers
let clientId: string;

async function resetDb() {
  await db.$transaction([
    db.payment.deleteMany(),
    db.quote.deleteMany(),
    db.booking.deleteMany(),
    db.client.deleteMany(),
    db.peakPeriod.deleteMany(),
    db.ratePlan.deleteMany(),
    db.space.deleteMany(),
    db.tourRequest.deleteMany(),
    db.venueMember.deleteMany(),
    db.venue.deleteMany(),
    db.user.deleteMany(),
  ]);
  const venue = await db.venue.create({
    data: { name: "Test Venue", slug: "test-venue", timezone: TZ },
  });
  venueId = venue.id;
  const hall = await db.space.create({
    data: {
      venueId,
      name: "Grand Hall",
      seatedCapacity: 200,
      standingCapacity: 300,
      setupBufferMins: 60,
      teardownBufferMins: 60,
    },
  });
  hallId = hall.id;
  const garden = await db.space.create({
    data: {
      venueId,
      name: "Garden",
      seatedCapacity: 80,
      standingCapacity: 120,
      setupBufferMins: 0,
      teardownBufferMins: 0,
    },
  });
  gardenId = garden.id;
  const client = await db.client.create({
    data: { venueId, name: "Ada Client", phone: "+15550001111" },
  });
  clientId = client.id;
}

function slot(
  dateStr: string,
  startTime: string,
  endDateStr: string,
  endTime: string,
  overrides: Partial<BookingSlotInput> = {}
): BookingSlotInput {
  return {
    venueId,
    spaceId: hallId,
    clientId,
    status: "CONFIRMED",
    source: "PHONE",
    eventType: "WEDDING",
    slotType: "HOURLY",
    start: venueLocalToUtc(TZ, dateStr, startTime),
    end: venueLocalToUtc(TZ, endDateStr, endTime),
    setupBufferMins: 60,
    teardownBufferMins: 60,
    guestCount: 100,
    lineItems: [],
    subtotalCents: 100_000,
    taxCents: 0,
    totalCents: 100_000,
    depositCents: 30_000,
    securityDepositCents: 0,
    ...overrides,
  };
}

beforeEach(resetDb);
afterAll(async () => {
  await db.$disconnect();
});

describe("exclusion constraint — basic overlap", () => {
  it("rejects a second booking overlapping the same space", async () => {
    const a = await createBooking(slot("2026-09-05", "18:00", "2026-09-05", "23:00"));
    expect(a.ok).toBe(true);
    const b = await createBooking(slot("2026-09-05", "20:00", "2026-09-06", "01:00"));
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.reason).toBe("SLOT_TAKEN");
  });

  it("allows the same time range in a different space", async () => {
    const a = await createBooking(slot("2026-09-05", "18:00", "2026-09-05", "23:00"));
    const b = await createBooking(
      slot("2026-09-05", "18:00", "2026-09-05", "23:00", {
        spaceId: gardenId,
        setupBufferMins: 0,
        teardownBufferMins: 0,
      })
    );
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });
});

describe("buffers — back-to-back events", () => {
  it("rejects event B whose setup overlaps event A's teardown", async () => {
    // A: 10:00–14:00 (+60 teardown → blocked till 15:00)
    const a = await createBooking(slot("2026-09-10", "10:00", "2026-09-10", "14:00"));
    expect(a.ok).toBe(true);
    // B: 15:30–20:00 with 60-min setup → blocked from 14:30 < 15:00. Overlap!
    const b = await createBooking(slot("2026-09-10", "15:30", "2026-09-10", "20:00"));
    expect(b.ok).toBe(false);
  });

  it("allows back-to-back when teardown and setup meet exactly (half-open)", async () => {
    // A blocked: [09:00, 15:00). B: 16:00–20:00, setup 60 → blocked [15:00, 21:00).
    const a = await createBooking(slot("2026-09-10", "10:00", "2026-09-10", "14:00"));
    const b = await createBooking(slot("2026-09-10", "16:00", "2026-09-10", "20:00"));
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  it("computes the blocked interval from buffers", () => {
    const start = venueLocalToUtc(TZ, "2026-09-10", "10:00");
    const end = venueLocalToUtc(TZ, "2026-09-10", "14:00");
    const { blockedStart, blockedEnd } = blockedInterval(start, end, 60, 90);
    expect(blockedStart.getTime()).toBe(start.getTime() - 60 * 60_000);
    expect(blockedEnd.getTime()).toBe(end.getTime() + 90 * 60_000);
  });
});

describe("statuses — what blocks and what doesn't", () => {
  it("INQUIRY and QUOTE_SENT never block the slot", async () => {
    const inquiry = await createBooking(
      slot("2026-09-12", "18:00", "2026-09-12", "23:00", { status: "INQUIRY" })
    );
    const quote = await createBooking(
      slot("2026-09-12", "18:00", "2026-09-12", "23:00", { status: "QUOTE_SENT" })
    );
    const confirmed = await createBooking(slot("2026-09-12", "18:00", "2026-09-12", "23:00"));
    expect(inquiry.ok && quote.ok && confirmed.ok).toBe(true);
  });

  it("CANCELLED bookings free the slot", async () => {
    const a = await createBooking(slot("2026-09-13", "18:00", "2026-09-13", "23:00"));
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    await db.booking.update({
      where: { id: a.bookingId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    const b = await createBooking(slot("2026-09-13", "18:00", "2026-09-13", "23:00"));
    expect(b.ok).toBe(true);
  });

  it("promoting an INQUIRY into a taken slot fails with alternatives", async () => {
    const inquiry = await createBooking(
      slot("2026-09-14", "18:00", "2026-09-14", "23:00", { status: "INQUIRY" })
    );
    const confirmed = await createBooking(slot("2026-09-14", "18:00", "2026-09-14", "23:00"));
    expect(inquiry.ok && confirmed.ok).toBe(true);
    if (!inquiry.ok) return;
    const promo = await transitionBooking(inquiry.bookingId, "CONFIRMED");
    expect(promo.ok).toBe(false);
    if (!promo.ok) {
      expect(promo.alternatives.spaces.map((s) => s.name)).toContain("Garden");
      expect(promo.alternatives.dates.length).toBeGreaterThan(0);
    }
  });
});

describe("penciled holds & expiry", () => {
  it("a live PENCILED hold blocks an online booking", async () => {
    const hold = await createBooking(
      slot("2026-09-19", "18:00", "2026-09-19", "23:00", {
        status: "PENCILED",
        holdExpiresAt: new Date(Date.now() + 3 * 86_400_000), // "held until Friday"
      })
    );
    expect(hold.ok).toBe(true);
    const online = await createBooking(
      slot("2026-09-19", "18:00", "2026-09-19", "23:00", { source: "ONLINE" })
    );
    expect(online.ok).toBe(false);
  });

  it("an EXPIRED penciled hold loses the race to an online booking", async () => {
    const hold = await createBooking(
      slot("2026-09-19", "18:00", "2026-09-19", "23:00", {
        status: "PENCILED",
        holdExpiresAt: new Date(Date.now() - 60_000), // expired a minute ago
      })
    );
    expect(hold.ok).toBe(true);
    const online = await createBooking(
      slot("2026-09-19", "18:00", "2026-09-19", "23:00", { source: "ONLINE" })
    );
    expect(online.ok).toBe(true); // stale hold auto-released
    if (!hold.ok) return;
    const released = await db.booking.findUnique({ where: { id: hold.bookingId } });
    expect(released?.status).toBe("EXPIRED");
  });

  it("rejects blocking holds without an expiry (DB check constraint)", async () => {
    await expect(
      createBooking(
        slot("2026-09-20", "18:00", "2026-09-20", "23:00", { status: "PENCILED" })
      )
    ).rejects.toThrow(/holdExpiresAt/);
  });
});

describe("concurrency — the same Saturday evening", () => {
  it("exactly one of two concurrent bookings wins", async () => {
    const [a, b] = await Promise.all([
      createBooking(slot("2026-09-26", "18:00", "2026-09-26", "23:00")),
      createBooking(slot("2026-09-26", "19:00", "2026-09-27", "00:00")),
    ]);
    const wins = [a, b].filter((r) => r.ok);
    const losses = [a, b].filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    const count = await db.booking.count({ where: { status: "CONFIRMED" } });
    expect(count).toBe(1);
  });

  it("ten concurrent attempts on one slot produce exactly one booking", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createBooking(slot("2026-10-03", "18:00", "2026-10-03", "23:00"))
      )
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });
});

describe("midnight-crossing events", () => {
  it("blocks the next morning when an event runs past midnight", async () => {
    // Party: Sat 20:00 → Sun 01:00 (+60 teardown → blocked till 02:00)
    const party = await createBooking(slot("2026-10-10", "20:00", "2026-10-11", "01:00"));
    expect(party.ok).toBe(true);
    // Sunday 01:30 breakfast setup (60 min → blocked from 00:30) must clash.
    const breakfast = await createBooking(slot("2026-10-11", "01:30", "2026-10-11", "05:00"));
    expect(breakfast.ok).toBe(false);
    // Sunday 03:00 (setup from 02:00) is fine.
    const later = await createBooking(slot("2026-10-11", "03:00", "2026-10-11", "07:00"));
    expect(later.ok).toBe(true);
  });
});

describe("alternatives on conflict", () => {
  it("suggests free sibling spaces and later dates", async () => {
    await createBooking(slot("2026-10-17", "18:00", "2026-10-17", "23:00"));
    const clash = await createBooking(
      slot("2026-10-17", "18:00", "2026-10-17", "23:00", { guestCount: 50 })
    );
    expect(clash.ok).toBe(false);
    if (clash.ok) return;
    expect(clash.alternatives.spaces.map((s) => s.name)).toContain("Garden");
    expect(clash.alternatives.dates.length).toBeGreaterThanOrEqual(1);
  });
});

describe("reschedule (calendar drag)", () => {
  it("moves a booking when the target slot is free and refuses when taken", async () => {
    const a = await createBooking(slot("2026-10-24", "10:00", "2026-10-24", "14:00"));
    const b = await createBooking(slot("2026-10-24", "18:00", "2026-10-24", "22:00"));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    // Drag A onto B's evening slot → refused.
    const clash = await rescheduleBooking(a.bookingId, {
      spaceId: hallId,
      start: venueLocalToUtc(TZ, "2026-10-24", "17:00"),
      end: venueLocalToUtc(TZ, "2026-10-24", "21:00"),
      setupBufferMins: 60,
      teardownBufferMins: 60,
    });
    expect(clash.ok).toBe(false);

    // Drag A to the Garden at the same time → fine.
    const moved = await rescheduleBooking(a.bookingId, {
      spaceId: gardenId,
      start: venueLocalToUtc(TZ, "2026-10-24", "10:00"),
      end: venueLocalToUtc(TZ, "2026-10-24", "14:00"),
      setupBufferMins: 0,
      teardownBufferMins: 0,
    });
    expect(moved.ok).toBe(true);
  });
});

describe("availability reads", () => {
  it("checkSlot and busyIntervals agree with the constraint", async () => {
    await createBooking(slot("2026-11-07", "18:00", "2026-11-07", "23:00"));
    expect(
      await checkSlot(
        hallId,
        venueLocalToUtc(TZ, "2026-11-07", "12:00"),
        venueLocalToUtc(TZ, "2026-11-07", "16:30"),
        60,
        60
      )
    ).toBe(false); // teardown until 17:30 hits the 17:00 setup start
    expect(
      await checkSlot(
        hallId,
        venueLocalToUtc(TZ, "2026-11-07", "12:00"),
        venueLocalToUtc(TZ, "2026-11-07", "15:00"),
        60,
        60
      )
    ).toBe(true);

    const busy = await busyIntervals(
      venueId,
      venueLocalToUtc(TZ, "2026-11-07", "00:00"),
      venueLocalToUtc(TZ, "2026-11-08", "00:00")
    );
    expect(busy).toHaveLength(1);
    expect(busy[0].spaceId).toBe(hallId);
  });
});
