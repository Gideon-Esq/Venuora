import { describe, expect, it } from "vitest";
import {
  billableQuarterHours,
  computeCancellationRefund,
  computeDeposit,
  computeSecurityRefund,
  effectiveMultiplierPct,
  priceBooking,
  type RatePlanInput,
} from "@/lib/pricing";
import { venueLocalToUtc } from "@/lib/time";

const TZ = "America/New_York";

const ratePlan: RatePlanInput = {
  hourlyRateCents: 15_000, // $150/hr
  minBookingHours: 3,
  halfDayCents: 60_000, // $600 / 5 hrs
  halfDayHours: 5,
  fullDayCents: 120_000, // $1,200 / 12 hrs
  fullDayHours: 12,
  eveningCents: 80_000, // $800 / 6 hrs
  eveningHours: 6,
  overtimeHourlyCents: 20_000, // $200/extra hr
  // Sun..Sat — Fri/Sat/Sun premium
  dowMultipliers: [110, 100, 100, 100, 100, 125, 150],
  peakPeriods: [
    { name: "December peak", startDate: "2026-12-15", endDate: "2026-12-31", multiplierPct: 140 },
  ],
};

// 2026-08-12 is a Wednesday; 2026-08-15 is a Saturday; 2026-12-19 is a Saturday.
const wedStart = venueLocalToUtc(TZ, "2026-08-12", "10:00");
const wedEnd = venueLocalToUtc(TZ, "2026-08-12", "16:00");

describe("billableQuarterHours", () => {
  it("rounds up to the nearest quarter hour", () => {
    expect(billableQuarterHours(2)).toBe(2);
    expect(billableQuarterHours(2.05)).toBe(2.25);
    expect(billableQuarterHours(2.26)).toBe(2.5);
  });
});

describe("effectiveMultiplierPct", () => {
  it("uses day-of-week multiplier alone off-peak", () => {
    expect(effectiveMultiplierPct(wedStart, TZ, ratePlan)).toBe(100);
    const sat = venueLocalToUtc(TZ, "2026-08-15", "18:00");
    expect(effectiveMultiplierPct(sat, TZ, ratePlan)).toBe(150);
  });

  it("composes dow and peak multipliers", () => {
    // Saturday (150) inside December peak (140) => 210
    const peakSat = venueLocalToUtc(TZ, "2026-12-19", "18:00");
    expect(effectiveMultiplierPct(peakSat, TZ, ratePlan)).toBe(210);
    // Wednesday (100) inside peak => 140
    const peakWed = venueLocalToUtc(TZ, "2026-12-16", "10:00");
    expect(effectiveMultiplierPct(peakWed, TZ, ratePlan)).toBe(140);
  });

  it("uses the event's venue-local date, not UTC", () => {
    // 23:00 New York on Dec 14 is Dec 15 in UTC — must NOT get peak pricing.
    const lateNight = venueLocalToUtc(TZ, "2026-12-14", "23:00");
    expect(effectiveMultiplierPct(lateNight, TZ, ratePlan)).toBe(100); // Monday
  });
});

describe("priceBooking — hourly", () => {
  it("prices a simple hourly booking", () => {
    const q = priceBooking({
      spaceName: "Grand Hall",
      ratePlan,
      slotType: "HOURLY",
      start: wedStart,
      end: wedEnd,
      timezone: TZ,
      addOns: [],
      taxBps: 0,
    });
    expect(q.subtotalCents).toBe(6 * 15_000);
    expect(q.totalCents).toBe(90_000);
    expect(q.billableHours).toBe(6);
  });

  it("enforces minimum booking hours", () => {
    const q = priceBooking({
      spaceName: "Grand Hall",
      ratePlan,
      slotType: "HOURLY",
      start: venueLocalToUtc(TZ, "2026-08-12", "10:00"),
      end: venueLocalToUtc(TZ, "2026-08-12", "11:00"), // 1 hr < 3 hr min
      timezone: TZ,
      addOns: [],
      taxBps: 0,
    });
    expect(q.billableHours).toBe(3);
    expect(q.subtotalCents).toBe(45_000);
  });

  it("applies the Saturday multiplier to the hourly rate", () => {
    const q = priceBooking({
      spaceName: "Grand Hall",
      ratePlan,
      slotType: "HOURLY",
      start: venueLocalToUtc(TZ, "2026-08-15", "10:00"),
      end: venueLocalToUtc(TZ, "2026-08-15", "14:00"),
      timezone: TZ,
      addOns: [],
      taxBps: 0,
    });
    expect(q.multiplierPct).toBe(150);
    expect(q.subtotalCents).toBe(4 * 22_500);
  });
});

describe("priceBooking — packages & overtime", () => {
  it("prices an evening package with no overtime", () => {
    const q = priceBooking({
      spaceName: "Grand Hall",
      ratePlan,
      slotType: "EVENING",
      start: venueLocalToUtc(TZ, "2026-08-12", "18:00"),
      end: venueLocalToUtc(TZ, "2026-08-13", "00:00"), // exactly 6 hrs
      timezone: TZ,
      addOns: [],
      taxBps: 0,
    });
    expect(q.subtotalCents).toBe(80_000);
    expect(q.overtimeHours).toBe(0);
  });

  it("charges overtime beyond package hours at the overtime rate", () => {
    // Saturday evening package running 8 hrs: 2 hrs overtime.
    const q = priceBooking({
      spaceName: "Grand Hall",
      ratePlan,
      slotType: "EVENING",
      start: venueLocalToUtc(TZ, "2026-08-15", "18:00"),
      end: venueLocalToUtc(TZ, "2026-08-16", "02:00"), // crosses midnight
      timezone: TZ,
      addOns: [],
      taxBps: 0,
    });
    // Package: 80_000 × 1.5 = 120_000; overtime: 2 × 20_000 × 1.5 = 60_000
    expect(q.overtimeHours).toBe(2);
    expect(q.subtotalCents).toBe(180_000);
    expect(q.lineItems).toHaveLength(2);
  });

  it("throws when the package is not configured", () => {
    expect(() =>
      priceBooking({
        spaceName: "Patio",
        ratePlan: { ...ratePlan, fullDayCents: null },
        slotType: "FULL_DAY",
        start: wedStart,
        end: wedEnd,
        timezone: TZ,
        addOns: [],
        taxBps: 0,
      })
    ).toThrow(/no FULL_DAY package/);
  });
});

describe("priceBooking — add-ons & tax", () => {
  it("prices per-unit and flat add-ons without multipliers, then taxes", () => {
    const q = priceBooking({
      spaceName: "Grand Hall",
      ratePlan,
      slotType: "HALF_DAY",
      start: venueLocalToUtc(TZ, "2026-08-15", "09:00"), // Saturday ×1.5
      end: venueLocalToUtc(TZ, "2026-08-15", "14:00"),
      timezone: TZ,
      addOns: [
        { name: "Chairs", pricingType: "PER_UNIT", unitCents: 250, quantity: 100 },
        { name: "Cleaning fee", pricingType: "FLAT", unitCents: 15_000, quantity: 1 },
        { name: "Projector", pricingType: "FLAT", unitCents: 5_000, quantity: 0 }, // skipped
      ],
      taxBps: 750, // 7.5%
    });
    // Space: 60_000 × 1.5 = 90_000; chairs 25_000; cleaning 15_000 → 130_000
    expect(q.subtotalCents).toBe(130_000);
    expect(q.taxCents).toBe(9_750);
    expect(q.totalCents).toBe(139_750);
    expect(q.lineItems.filter((li) => li.kind === "ADDON")).toHaveLength(2);
  });
});

describe("deposits", () => {
  it("computes percentage deposits with rounding", () => {
    expect(computeDeposit(139_750, 30)).toBe(41_925);
    expect(computeDeposit(99, 30)).toBe(30);
  });
});

describe("computeCancellationRefund — tiered policy", () => {
  const tiers = [
    { minDaysBefore: 60, refundPct: 100 },
    { minDaysBefore: 30, refundPct: 50 },
    { minDaysBefore: 0, refundPct: 0 },
  ];

  it("refunds 100% more than 60 days out", () => {
    expect(computeCancellationRefund(50_000, tiers, 61)).toEqual({
      refundPct: 100,
      refundCents: 50_000,
    });
    expect(computeCancellationRefund(50_000, tiers, 60).refundPct).toBe(100);
  });

  it("refunds 50% between 30 and 59 days", () => {
    expect(computeCancellationRefund(50_000, tiers, 45)).toEqual({
      refundPct: 50,
      refundCents: 25_000,
    });
    expect(computeCancellationRefund(50_001, tiers, 30).refundCents).toBe(25_001); // rounds half up
  });

  it("refunds nothing inside 30 days", () => {
    expect(computeCancellationRefund(50_000, tiers, 29).refundCents).toBe(0);
    expect(computeCancellationRefund(50_000, tiers, 0).refundCents).toBe(0);
  });

  it("handles unordered tiers and nothing paid", () => {
    const shuffled = [tiers[1], tiers[2], tiers[0]];
    expect(computeCancellationRefund(10_000, shuffled, 90).refundPct).toBe(100);
    expect(computeCancellationRefund(0, tiers, 90).refundCents).toBe(0);
  });
});

describe("computeSecurityRefund — partial refunds", () => {
  it("refunds the full deposit with no deductions", () => {
    expect(computeSecurityRefund(50_000, [])).toEqual({
      deductedCents: 0,
      refundCents: 50_000,
    });
  });

  it("subtracts itemized deductions", () => {
    expect(
      computeSecurityRefund(50_000, [
        { reason: "Broken chair", amountCents: 7_500 },
        { reason: "Extra cleaning", amountCents: 10_000 },
      ])
    ).toEqual({ deductedCents: 17_500, refundCents: 32_500 });
  });

  it("never refunds negative when deductions exceed the deposit", () => {
    expect(
      computeSecurityRefund(20_000, [{ reason: "Damage", amountCents: 35_000 }])
    ).toEqual({ deductedCents: 20_000, refundCents: 0 });
  });
});
