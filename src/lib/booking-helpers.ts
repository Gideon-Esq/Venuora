// Bridges validated form input → priced BookingSlotInput. Used by both the
// owner fast-booking form and the public online flow so pricing snapshots
// are always produced the same way.

import type { AddOn, RatePlan, PeakPeriod, Space, Venue } from "@/generated/prisma/client";
import { db } from "./db";
import { computeDeposit, priceBooking, type AddOnSelection, type PriceQuote, type RatePlanInput } from "./pricing";
import { addDays, venueLocalToUtc } from "./time";

export type SpaceWithRates = Space & { ratePlan: (RatePlan & { peakPeriods: PeakPeriod[] }) | null };

export function toRatePlanInput(rp: RatePlan & { peakPeriods: PeakPeriod[] }): RatePlanInput {
  return {
    hourlyRateCents: rp.hourlyRateCents,
    minBookingHours: rp.minBookingHours,
    halfDayCents: rp.halfDayCents,
    halfDayHours: rp.halfDayHours,
    fullDayCents: rp.fullDayCents,
    fullDayHours: rp.fullDayHours,
    eveningCents: rp.eveningCents,
    eveningHours: rp.eveningHours,
    overtimeHourlyCents: rp.overtimeHourlyCents,
    dowMultipliers: rp.dowMultipliers as number[],
    peakPeriods: rp.peakPeriods.map((p) => ({
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      multiplierPct: p.multiplierPct,
    })),
  };
}

export interface SlotSelection {
  date: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  slotType: "HOURLY" | "HALF_DAY" | "FULL_DAY" | "EVENING";
}

export function slotToRange(venue: Venue, sel: SlotSelection): { start: Date; end: Date } {
  const start = venueLocalToUtc(venue.timezone, sel.date, sel.startTime);
  let end = venueLocalToUtc(venue.timezone, sel.date, sel.endTime);
  if (sel.endsNextDay || end <= start) {
    // Midnight-crossing event: end time is on the next venue-local day.
    end = venueLocalToUtc(venue.timezone, nextDateStr(sel.date), sel.endTime);
  }
  return { start, end };
}

function nextDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/** Resolve selected add-ons against the venue catalog (server-side prices). */
export async function resolveAddOns(
  venueId: string,
  selections: { addOnId: string; quantity: number }[]
): Promise<AddOnSelection[]> {
  if (selections.length === 0) return [];
  const catalog = await db.addOn.findMany({
    where: { venueId, active: true, id: { in: selections.map((s) => s.addOnId) } },
  });
  const byId = new Map<string, AddOn>(catalog.map((a) => [a.id, a]));
  const resolved: AddOnSelection[] = [];
  for (const sel of selections) {
    const addOn = byId.get(sel.addOnId);
    if (!addOn || sel.quantity <= 0) continue;
    const qty = addOn.maxQuantity ? Math.min(sel.quantity, addOn.maxQuantity) : sel.quantity;
    resolved.push({
      name: addOn.name,
      pricingType: addOn.pricingType,
      unitCents: addOn.priceCents,
      quantity: addOn.pricingType === "FLAT" ? 1 : qty,
    });
  }
  return resolved;
}

export interface PricedSelection {
  start: Date;
  end: Date;
  quote: PriceQuote;
  depositCents: number;
  securityDepositCents: number;
  balanceDueDate: Date;
}

/** Price a slot selection with the venue's policies applied. */
export function priceSelection(
  venue: Venue,
  space: SpaceWithRates,
  sel: SlotSelection,
  addOns: AddOnSelection[]
): PricedSelection {
  if (!space.ratePlan) throw new Error("Space has no rate plan yet");
  const { start, end } = slotToRange(venue, sel);
  const quote = priceBooking({
    spaceName: space.name,
    ratePlan: toRatePlanInput(space.ratePlan),
    slotType: sel.slotType,
    start,
    end,
    timezone: venue.timezone,
    addOns,
    taxBps: venue.taxBps,
  });
  return {
    start,
    end,
    quote,
    depositCents: computeDeposit(quote.totalCents, venue.depositPct),
    securityDepositCents: venue.securityDepositCents,
    balanceDueDate: addDays(start, -venue.balanceDueDays),
  };
}

/** Find or create a client by phone/email within the venue. */
export async function upsertClient(
  venueId: string,
  data: { name: string; phone?: string | null; email?: string | null }
) {
  const phone = data.phone?.trim() || null;
  const email = data.email?.trim().toLowerCase() || null;
  const existing = await db.client.findFirst({
    where: {
      venueId,
      OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
    },
  });
  if (existing) {
    return db.client.update({
      where: { id: existing.id },
      data: {
        name: data.name || existing.name,
        phone: phone ?? existing.phone,
        email: email ?? existing.email,
      },
    });
  }
  return db.client.create({ data: { venueId, name: data.name, phone, email } });
}
