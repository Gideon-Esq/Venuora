// Shared types + pure calendar-date helpers for the owner calendar.
// Date strings ("YYYY-MM-DD") are venue-local calendar dates; instants are
// passed to the client as epoch milliseconds and always rendered through
// @/lib/time with the venue's timezone.

import type { RatePlanInput } from "@/lib/pricing";
import type { BookingStatus, EventType, SlotType } from "@/generated/prisma/enums";
import { formatInVenueTz, venueLocalToUtc } from "@/lib/time";

export type CalView = "month" | "week" | "day";

export interface CalSpace {
  id: string;
  name: string;
  color: string;
  seatedCapacity?: number;
  standingCapacity?: number;
  ratePlan?: RatePlanInput | null;
  /** Space buffers in minutes (setup before / teardown after the event). */
  setupBufferMins: number;
  teardownBufferMins: number;
}

export interface CalBooking {
  id: string;
  spaceId: string;
  spaceName: string;
  status: BookingStatus;
  eventType: EventType;
  slotType: SlotType;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  /** Epoch ms (UTC instants). */
  start: number;
  end: number;
  blockedStart: number;
  blockedEnd: number;
  guestCount: number;
  totalCents: number;
  depositCents: number;
  notes?: string | null;
  paidCents?: number;
  /** Epoch ms; PENCILED/HOLD only. */
  holdExpiresAt: number | null;
}

/** Target of a move/reschedule (matches previewRescheduleAction's shape). */
export interface MoveTarget {
  spaceId: string;
  date: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
}

/**
 * UTC instants (epoch ms) for a venue-local target — mirrors the server's
 * slotToRange (end at or before start means the event ends next day) and
 * extends by the space's buffers for the blocked window.
 */
export function targetRange(
  timezone: string,
  t: Omit<MoveTarget, "spaceId">,
  space?: Pick<CalSpace, "setupBufferMins" | "teardownBufferMins">
): { start: number; end: number; blockedStart: number | null; blockedEnd: number | null } {
  const start = venueLocalToUtc(timezone, t.date, t.startTime).getTime();
  let end = venueLocalToUtc(timezone, t.date, t.endTime).getTime();
  if (t.endsNextDay || end <= start) {
    end = venueLocalToUtc(timezone, addDaysStr(t.date, 1), t.endTime).getTime();
  }
  return {
    start,
    end,
    blockedStart: space ? start - space.setupBufferMins * 60_000 : null,
    blockedEnd: space ? end + space.teardownBufferMins * 60_000 : null,
  };
}

/** Statuses that don't block the slot — rendered faintly with dashed borders. */
export function isTentative(status: BookingStatus): boolean {
  return status === "INQUIRY" || status === "QUOTE_SENT";
}

// --- pure "YYYY-MM-DD" calendar-date math (timezone-independent) -----------

export function parseDateStr(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}

function fromUtcDate(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDaysStr(dateStr: string, n: number): string {
  const { y, m, d } = parseDateStr(dateStr);
  return fromUtcDate(new Date(Date.UTC(y, m - 1, d + n)));
}

export function addMonthsStr(dateStr: string, n: number): string {
  const { y, m, d } = parseDateStr(dateStr);
  // Clamp to day 1 so month arithmetic never skips (Jan 31 + 1mo etc.).
  void d;
  return fromUtcDate(new Date(Date.UTC(y, m - 1 + n, 1)));
}

/** 0 = Sunday … 6 = Saturday for a calendar date. */
export function dowOfStr(dateStr: string): number {
  const { y, m, d } = parseDateStr(dateStr);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday-first weekday index: 0 = Monday … 6 = Sunday. */
export function mondayIndexOfStr(dateStr: string): number {
  return (dowOfStr(dateStr) + 6) % 7;
}

/** The Monday that starts the (Mon–Sun) week containing `dateStr`. */
export function startOfWeekStr(dateStr: string): string {
  return addDaysStr(dateStr, -mondayIndexOfStr(dateStr));
}

export function startOfMonthStr(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const DOWS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOWS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Monday-first weekday names for grid headers. */
export const WEEKDAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0].map((i) => ({
  long: DOWS_LONG[i],
  short: DOWS_SHORT[i],
}));

/** "Tuesday, October 14" — agenda group headings. */
export function longDayTitle(dateStr: string): string {
  const { m, d } = parseDateStr(dateStr);
  return `${DOWS_LONG[dowOfStr(dateStr)]}, ${MONTHS[m - 1]} ${d}`;
}

export function monthTitle(dateStr: string): string {
  const { y, m } = parseDateStr(dateStr);
  return `${MONTHS[m - 1]} ${y}`;
}

export function shortDate(dateStr: string): string {
  const { m, d } = parseDateStr(dateStr);
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

export function dayTitle(dateStr: string): string {
  const { y, m, d } = parseDateStr(dateStr);
  return `${DOWS_SHORT[dowOfStr(dateStr)]}, ${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}

export function dayHeaderLabel(dateStr: string): string {
  return `${DOWS_SHORT[dowOfStr(dateStr)]} ${parseDateStr(dateStr).d}`;
}

export function weekTitle(weekStart: string): string {
  const end = addDaysStr(weekStart, 6);
  const a = parseDateStr(weekStart);
  const b = parseDateStr(end);
  if (a.m === b.m) return `${MONTHS_SHORT[a.m - 1]} ${a.d} – ${b.d}, ${a.y}`;
  return `${MONTHS_SHORT[a.m - 1]} ${a.d} – ${MONTHS_SHORT[b.m - 1]} ${b.d}, ${b.y}`;
}

function daysInMonth(dateStr: string): number {
  const { y, m } = parseDateStr(dateStr);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Monday-first month grid covering the anchor's month: whole weeks only
 * (35 or 42 cells, 28 for a Feb that starts on Monday).
 */
export function monthGridDays(anchor: string): string[] {
  const first = startOfMonthStr(anchor);
  const lead = mondayIndexOfStr(first);
  const cells = Math.ceil((lead + daysInMonth(first)) / 7) * 7;
  const gridStart = addDaysStr(first, -lead);
  return Array.from({ length: cells }, (_, i) => addDaysStr(gridStart, i));
}

/** Monday → Sunday of the anchor's week. */
export function weekDays(anchor: string): string[] {
  const start = startOfWeekStr(anchor);
  return Array.from({ length: 7 }, (_, i) => addDaysStr(start, i));
}

/** Venue-local calendar days a view shows (drives both server query + UI). */
export function visibleDays(view: CalView, anchor: string): string[] {
  if (view === "month") return monthGridDays(anchor);
  if (view === "week") return weekDays(anchor);
  return [anchor];
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Minutes-since-local-midnight → "HH:MM" (wraps past 24h). */
export function minutesToTimeStr(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** Timeline window: 6:00 → 26:00 (2:00 next day), venue-local. */
export const HOUR_START = 6;
export const HOUR_END = 26;
export const HOURS_VISIBLE = HOUR_END - HOUR_START;

// --- one colour system: tone by booking status ------------------------------

export type CalTone = "confirmed" | "hold" | "tentative" | "done";

export function toneOf(status: BookingStatus): CalTone {
  switch (status) {
    case "CONFIRMED":
      return "confirmed";
    case "PENCILED":
    case "HOLD":
      return "hold";
    case "INQUIRY":
    case "QUOTE_SENT":
      return "tentative";
    default:
      return "done";
  }
}

/** Status filter groups shown in the "All statuses" select. */
export const STATUS_GROUPS: { value: CalTone; label: string; statuses: BookingStatus[] }[] = [
  { value: "confirmed", label: "Confirmed", statuses: ["CONFIRMED"] },
  { value: "hold", label: "Penciled / hold", statuses: ["PENCILED", "HOLD"] },
  { value: "tentative", label: "Inquiry / quote", statuses: ["INQUIRY", "QUOTE_SENT"] },
  { value: "done", label: "Completed / no-show", statuses: ["COMPLETED", "NO_SHOW"] },
];

/** Tailwind classes for month chips / agenda accents, per tone. */
export const TONE_CHIP: Record<CalTone, string> = {
  confirmed: "border border-primary/25 border-l-[3px] border-l-primary bg-accent text-accent-foreground",
  hold: "border border-warning-border border-l-[3px] border-l-[#c98a1b] bg-warning-soft text-warning",
  tentative: "border border-dashed border-[#8b8797] bg-card text-muted-foreground",
  done: "border border-border bg-muted text-muted-foreground",
};

/** Hex colours for timeline bars (inline styles), per tone. */
export const TONE_BAR: Record<
  CalTone,
  { core: string; text: string; hatch: string; border: string }
> = {
  confirmed: { core: "#5145ae", text: "#ffffff", hatch: "#5145ae", border: "#5145ae" },
  hold: { core: "#f3dfa8", text: "#6b3a0a", hatch: "#c98a1b", border: "#c98a1b" },
  tentative: { core: "transparent", text: "#3f3d48", hatch: "#8b8797", border: "#8b8797" },
  done: { core: "#e4e0d6", text: "#4a4753", hatch: "#a39f95", border: "#bdb8ad" },
};

// --- operating hours + free windows -----------------------------------------

/** One weekday's operating hours (Venue.operatingHours, venue-local "HH:MM"). */
export interface OpenHours {
  dow: number; // 0 = Sunday … 6 = Saturday
  open: string;
  close: string;
  closed: boolean;
}

export interface Interval {
  start: number;
  end: number;
}

/**
 * The venue's operating window for a venue-local day as UTC epoch ms, or null
 * when the venue is closed that day. A close at or before open means the
 * venue closes after midnight. Without configured hours we fall back to the
 * timeline window (06:00 → 02:00 next day).
 */
export function operatingWindow(timezone: string, day: string, hours: OpenHours[]): Interval | null {
  const h = hours.find((x) => x.dow === dowOfStr(day));
  if (h?.closed) return null;
  const open = h?.open ?? minutesToTimeStr(HOUR_START * 60);
  const close = h?.close ?? minutesToTimeStr(HOUR_END * 60);
  const start = venueLocalToUtc(timezone, day, open).getTime();
  let end = venueLocalToUtc(timezone, day, close).getTime();
  if (end <= start) end = venueLocalToUtc(timezone, addDaysStr(day, 1), close).getTime();
  return { start, end };
}

/** Bookings that actually hold the space (inquiries/quotes don't). */
export function blocksSpace(b: CalBooking): boolean {
  return !isTentative(b.status);
}

/**
 * Gaps of at least `minMins` inside `win` not covered by any busy interval
 * (busy = blocked windows, i.e. including setup/teardown buffers). With a
 * space, each gap is narrowed by that space's own buffers so the result is
 * an event time a new booking can actually take.
 */
export function freeWindows(
  win: Interval,
  busy: Interval[],
  /** Space whose setup/teardown must also fit — windows are shrunk to bookable event times. */
  space?: Pick<CalSpace, "setupBufferMins" | "teardownBufferMins">,
  minMins = 30
): Interval[] {
  const sorted = busy
    .filter((b) => b.end > win.start && b.start < win.end)
    .sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  let cursor = win.start;
  for (const b of sorted) {
    if (b.start > cursor) out.push({ start: cursor, end: Math.min(b.start, win.end) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= win.end) break;
  }
  if (cursor < win.end) out.push({ start: cursor, end: win.end });
  const pre = (space?.setupBufferMins ?? 0) * 60_000;
  const post = (space?.teardownBufferMins ?? 0) * 60_000;
  return out
    .map((w) => ({ start: w.start + pre, end: w.end - post }))
    .filter((w) => w.end - w.start >= minMins * 60_000);
}

/** "6:00–10:00 PM" / "9:00 AM–1:00 PM" in venue-local time. */
export function timeRange(start: number, end: number, timezone: string): string {
  const a = formatInVenueTz(new Date(start), timezone, "h:mm a");
  const b = formatInVenueTz(new Date(end), timezone, "h:mm a");
  const [at, am] = a.split(" ");
  const [bt, bm] = b.split(" ");
  const sameDay =
    formatInVenueTz(new Date(start), timezone, "yyyy-MM-dd") ===
    formatInVenueTz(new Date(end - 1), timezone, "yyyy-MM-dd");
  return am === bm && sameDay ? `${at}–${bt} ${bm}` : `${a}–${b}`;
}

/** New-booking prefill for a free window (venue-local date + times). */
export function windowPrefill(timezone: string, w: Interval, spaceId: string | undefined) {
  const date = formatInVenueTz(new Date(w.start), timezone, "yyyy-MM-dd");
  const endDate = formatInVenueTz(new Date(w.end), timezone, "yyyy-MM-dd");
  return {
    date,
    spaceId,
    startTime: formatInVenueTz(new Date(w.start), timezone, "HH:mm"),
    endTime: formatInVenueTz(new Date(w.end), timezone, "HH:mm"),
    endsNextDay: endDate > date,
  };
}
