// Shared types + pure calendar-date helpers for the owner calendar.
// Date strings ("YYYY-MM-DD") are venue-local calendar dates; instants are
// passed to the client as epoch milliseconds and always rendered through
// @/lib/time with the venue's timezone.

import type { BookingStatus, EventType, SlotType } from "@/generated/prisma/enums";

export type CalView = "month" | "week" | "day";

export interface CalSpace {
  id: string;
  name: string;
  color: string;
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
  /** Epoch ms (UTC instants). */
  start: number;
  end: number;
  blockedStart: number;
  blockedEnd: number;
  guestCount: number;
  totalCents: number;
  depositCents: number;
}

/** Target of a move/reschedule (matches previewRescheduleAction's shape). */
export interface MoveTarget {
  spaceId: string;
  date: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
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

export function startOfMonthStr(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const DOWS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

/** 42-cell month grid (Sunday-first) covering the anchor's month. */
export function monthGridDays(anchor: string): string[] {
  const first = startOfMonthStr(anchor);
  const gridStart = addDaysStr(first, -dowOfStr(first));
  return Array.from({ length: 42 }, (_, i) => addDaysStr(gridStart, i));
}

export function weekDays(anchor: string): string[] {
  const start = addDaysStr(anchor, -dowOfStr(anchor));
  return Array.from({ length: 7 }, (_, i) => addDaysStr(start, i));
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

/** Readable text color for a solid status/space background. */
export function textOn(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#27272a" : "#ffffff";
}
