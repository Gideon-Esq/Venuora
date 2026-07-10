// Month-grid free/busy rollup for the public venue page. Server-only.
// Free/busy ONLY — no client details ever leave this module.

import { busyIntervals } from "@/lib/booking";
import { venueDateStr, venueLocalToUtc } from "@/lib/time";

export type DayStatus = "free" | "partly" | "full";

export interface CalendarDay {
  date: string; // venue-local YYYY-MM-DD
  dayOfMonth: number;
  status: DayStatus;
  isPast: boolean;
}

export interface MonthGrid {
  month: string; // YYYY-MM
  label: string; // "August 2026"
  leadingBlanks: number; // cells before the 1st (Sunday-first grid)
  days: CalendarDay[];
  prevMonth: string | null; // null when out of the allowed window
  nextMonth: string | null;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
// Bookable "core hours" a day must be fully blocked across to count as full.
const CORE_START = "08:00";
const CORE_END = "22:00";
const MAX_MONTHS_AHEAD = 18;

function monthIndex(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return y * 12 + (m - 1);
}

function monthFromIndex(idx: number): string {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function normalizeMonth(raw: string | undefined, timezone: string): string {
  const current = venueDateStr(new Date(), timezone).slice(0, 7);
  if (!raw || !MONTH_RE.test(raw)) return current;
  const idx = monthIndex(raw);
  const cur = monthIndex(current);
  if (idx < cur) return current;
  if (idx > cur + MAX_MONTHS_AHEAD) return monthFromIndex(cur + MAX_MONTHS_AHEAD);
  return raw;
}

interface Interval {
  start: number;
  end: number;
}

/** Do the merged `intervals` fully cover [from, to)? */
function covers(intervals: Interval[], from: number, to: number): boolean {
  const clipped = intervals
    .map((i) => ({ start: Math.max(i.start, from), end: Math.min(i.end, to) }))
    .filter((i) => i.start < i.end)
    .sort((a, b) => a.start - b.start);
  let cursor = from;
  for (const i of clipped) {
    if (i.start > cursor) return false;
    cursor = Math.max(cursor, i.end);
    if (cursor >= to) return true;
  }
  return cursor >= to;
}

/**
 * Roll venue busy intervals up to one Free / Partly / Fully-booked status per
 * venue-local day: a space counts as full when its blocked intervals cover
 * the whole 08:00–22:00 core; the day is full when every active space is.
 */
export async function monthAvailability(
  venue: { id: string; timezone: string },
  spaceIds: string[],
  month: string
): Promise<MonthGrid> {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const nextMonthStr = monthFromIndex(monthIndex(month) + 1);

  const from = venueLocalToUtc(venue.timezone, `${month}-01`, "00:00");
  const to = venueLocalToUtc(venue.timezone, `${nextMonthStr}-01`, "00:00");
  const busy = await busyIntervals(venue.id, from, to);

  const bySpace = new Map<string, Interval[]>();
  for (const b of busy) {
    const list = bySpace.get(b.spaceId) ?? [];
    list.push({ start: b.blockedStart.getTime(), end: b.blockedEnd.getTime() });
    bySpace.set(b.spaceId, list);
  }

  const today = venueDateStr(new Date(), venue.timezone);
  const days: CalendarDay[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const dayStart = venueLocalToUtc(venue.timezone, date, "00:00").getTime();
    const dayEnd =
      d === daysInMonth
        ? venueLocalToUtc(venue.timezone, `${nextMonthStr}-01`, "00:00").getTime()
        : venueLocalToUtc(venue.timezone, `${month}-${String(d + 1).padStart(2, "0")}`, "00:00").getTime();
    const coreStart = venueLocalToUtc(venue.timezone, date, CORE_START).getTime();
    const coreEnd = venueLocalToUtc(venue.timezone, date, CORE_END).getTime();

    let anyBusy = false;
    let allFull = spaceIds.length > 0;
    for (const spaceId of spaceIds) {
      const intervals = (bySpace.get(spaceId) ?? []).filter(
        (i) => i.start < dayEnd && i.end > dayStart
      );
      if (intervals.length === 0) {
        allFull = false;
        continue;
      }
      anyBusy = true;
      if (!covers(intervals, coreStart, coreEnd)) allFull = false;
    }

    days.push({
      date,
      dayOfMonth: d,
      status: allFull && anyBusy ? "full" : anyBusy ? "partly" : "free",
      isPast: date < today,
    });
  }

  const idx = monthIndex(month);
  const cur = monthIndex(today.slice(0, 7));
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));

  return {
    month,
    label,
    leadingBlanks: new Date(Date.UTC(y, m - 1, 1)).getUTCDay(),
    days,
    prevMonth: idx > cur ? monthFromIndex(idx - 1) : null,
    nextMonth: idx < cur + MAX_MONTHS_AHEAD ? monthFromIndex(idx + 1) : null,
  };
}
