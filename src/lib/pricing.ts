// Pure pricing engine. No IO, no Prisma — fully unit-testable.
// All money in integer cents; multipliers as whole-number percentages
// (100 = x1.0, 125 = +25%).

import { applyBps, applyPct, roundCents } from "./money";
import { durationHours, venueDateStr, venueDow } from "./time";

export type SlotTypeInput = "HOURLY" | "HALF_DAY" | "FULL_DAY" | "EVENING";

export interface PeakPeriodInput {
  name: string;
  startDate: string; // "2026-12-15" venue-local, inclusive
  endDate: string; // "2026-12-31" venue-local, inclusive
  multiplierPct: number; // 140 = +40%
}

export interface RatePlanInput {
  hourlyRateCents: number;
  minBookingHours: number;
  halfDayCents: number | null;
  halfDayHours: number;
  fullDayCents: number | null;
  fullDayHours: number;
  eveningCents: number | null;
  eveningHours: number;
  overtimeHourlyCents: number | null; // falls back to hourlyRateCents
  dowMultipliers: number[]; // index 0 = Sunday … 6 = Saturday
  peakPeriods: PeakPeriodInput[];
}

export interface AddOnSelection {
  name: string;
  pricingType: "PER_UNIT" | "FLAT";
  unitCents: number;
  quantity: number; // FLAT items should pass 1
}

export interface PriceBookingInput {
  spaceName: string;
  ratePlan: RatePlanInput;
  slotType: SlotTypeInput;
  start: Date;
  end: Date;
  timezone: string;
  addOns: AddOnSelection[];
  taxBps: number; // 750 = 7.5%
}

export interface LineItem {
  kind: "SPACE" | "OVERTIME" | "ADDON";
  label: string;
  qty: number;
  unitCents: number;
  totalCents: number;
}

export interface PriceQuote {
  lineItems: LineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** Combined dow × peak multiplier actually applied to space charges. */
  multiplierPct: number;
  billableHours: number;
  overtimeHours: number;
}

/** Round hours UP to the nearest quarter hour for billing. */
export function billableQuarterHours(hours: number): number {
  return Math.ceil(hours * 4 - 1e-9) / 4;
}

function packageFor(slotType: SlotTypeInput, rp: RatePlanInput) {
  switch (slotType) {
    case "HALF_DAY":
      return { cents: rp.halfDayCents, includedHours: rp.halfDayHours, label: "Half-day package" };
    case "FULL_DAY":
      return { cents: rp.fullDayCents, includedHours: rp.fullDayHours, label: "Full-day package" };
    case "EVENING":
      return { cents: rp.eveningCents, includedHours: rp.eveningHours, label: "Evening package" };
    default:
      return null;
  }
}

/**
 * Combined multiplier for the event's start date (venue-local):
 * day-of-week multiplier composed with any date-specific peak override.
 * Overlapping peak periods: the highest one wins (they don't stack).
 */
export function effectiveMultiplierPct(
  start: Date,
  timezone: string,
  rp: RatePlanInput
): number {
  const dow = venueDow(start, timezone);
  const dowPct = rp.dowMultipliers[dow] ?? 100;
  const dateStr = venueDateStr(start, timezone);
  let peakPct = 100;
  for (const p of rp.peakPeriods) {
    if (dateStr >= p.startDate && dateStr <= p.endDate) {
      peakPct = Math.max(peakPct, p.multiplierPct);
    }
  }
  return Math.round((dowPct * peakPct) / 100);
}

export function priceBooking(input: PriceBookingInput): PriceQuote {
  const { ratePlan: rp, slotType, start, end, timezone, spaceName } = input;
  if (end <= start) throw new Error("end must be after start");

  const rawHours = durationHours(start, end);
  const multiplierPct = effectiveMultiplierPct(start, timezone, rp);
  const lineItems: LineItem[] = [];
  let billableHours: number;
  let overtimeHours = 0;

  if (slotType === "HOURLY") {
    billableHours = Math.max(billableQuarterHours(rawHours), rp.minBookingHours);
    const unit = applyPct(rp.hourlyRateCents, multiplierPct);
    lineItems.push({
      kind: "SPACE",
      label: `${spaceName} — hourly (${billableHours} hr${billableHours === 1 ? "" : "s"})`,
      qty: billableHours,
      unitCents: unit,
      totalCents: roundCents(unit * billableHours),
    });
  } else {
    const pkg = packageFor(slotType, rp);
    if (!pkg || pkg.cents == null) {
      throw new Error(`Space has no ${slotType} package configured`);
    }
    billableHours = pkg.includedHours;
    lineItems.push({
      kind: "SPACE",
      label: `${spaceName} — ${pkg.label}`,
      qty: 1,
      unitCents: applyPct(pkg.cents, multiplierPct),
      totalCents: applyPct(pkg.cents, multiplierPct),
    });
    overtimeHours = Math.max(0, billableQuarterHours(rawHours - pkg.includedHours));
    if (overtimeHours > 0) {
      const otRate = rp.overtimeHourlyCents ?? rp.hourlyRateCents;
      const unit = applyPct(otRate, multiplierPct);
      lineItems.push({
        kind: "OVERTIME",
        label: `Overtime (${overtimeHours} hr${overtimeHours === 1 ? "" : "s"})`,
        qty: overtimeHours,
        unitCents: unit,
        totalCents: roundCents(unit * overtimeHours),
      });
      billableHours += overtimeHours;
    }
  }

  for (const a of input.addOns) {
    if (a.quantity <= 0) continue;
    const qty = a.pricingType === "FLAT" ? 1 : a.quantity;
    lineItems.push({
      kind: "ADDON",
      label: qty > 1 ? `${a.name} × ${qty}` : a.name,
      qty,
      unitCents: a.unitCents,
      totalCents: roundCents(a.unitCents * qty),
    });
  }

  const subtotalCents = lineItems.reduce((s, li) => s + li.totalCents, 0);
  const taxCents = applyBps(subtotalCents, input.taxBps);

  return {
    lineItems,
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
    multiplierPct,
    billableHours,
    overtimeHours,
  };
}

// ---------------------------------------------------------------------------
// Deposits & balances
// ---------------------------------------------------------------------------

export function computeDeposit(totalCents: number, depositPct: number): number {
  return applyPct(totalCents, depositPct);
}

// ---------------------------------------------------------------------------
// Tiered cancellation refunds
// ---------------------------------------------------------------------------

export interface CancellationTier {
  minDaysBefore: number; // tier applies when daysBefore >= minDaysBefore
  refundPct: number;
}

/**
 * Refund for a cancellation `daysBefore` calendar days ahead of the event.
 * Tiers are matched most-generous-first (highest minDaysBefore).
 * The refundable security deposit is NOT part of `paidCents` — it is always
 * returned in full on cancellation and handled separately.
 */
export function computeCancellationRefund(
  paidCents: number,
  tiers: CancellationTier[],
  daysBefore: number
): { refundPct: number; refundCents: number } {
  const sorted = [...tiers].sort((a, b) => b.minDaysBefore - a.minDaysBefore);
  for (const tier of sorted) {
    if (daysBefore >= tier.minDaysBefore) {
      return {
        refundPct: tier.refundPct,
        refundCents: applyPct(Math.max(0, paidCents), tier.refundPct),
      };
    }
  }
  return { refundPct: 0, refundCents: 0 };
}

// ---------------------------------------------------------------------------
// Security (caution) deposit refunds
// ---------------------------------------------------------------------------

export interface SecurityDeduction {
  reason: string;
  amountCents: number;
}

/**
 * Post-event security deposit settlement. Deductions cannot exceed the
 * deposit; the remainder is refunded.
 */
export function computeSecurityRefund(
  securityDepositCents: number,
  deductions: SecurityDeduction[]
): { deductedCents: number; refundCents: number } {
  const requested = deductions.reduce(
    (s, d) => s + Math.max(0, roundCents(d.amountCents)),
    0
  );
  const deductedCents = Math.min(requested, securityDepositCents);
  return { deductedCents, refundCents: securityDepositCents - deductedCents };
}
