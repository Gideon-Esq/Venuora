import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

// Bookings are [start, end) half-open UTC instants. Every user-facing
// operation happens in the venue's IANA timezone via these helpers.

/** Interpret a venue-local calendar date + wall-clock time as a UTC instant. */
export function venueLocalToUtc(
  timezone: string,
  dateStr: string, // "2026-08-15"
  timeStr: string // "18:00"
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm ?? 0, 0, timezone).getTime());
}

/** A UTC instant viewed through the venue's timezone. */
export function inVenueTz(date: Date, timezone: string): TZDate {
  return new TZDate(date.getTime(), timezone);
}

/** Venue-local "YYYY-MM-DD" for an instant. */
export function venueDateStr(date: Date, timezone: string): string {
  return format(inVenueTz(date, timezone), "yyyy-MM-dd");
}

/** Venue-local day of week (0 = Sunday … 6 = Saturday) for an instant. */
export function venueDow(date: Date, timezone: string): number {
  return inVenueTz(date, timezone).getDay();
}

export function formatInVenueTz(
  date: Date,
  timezone: string,
  fmt = "EEE, MMM d yyyy 'at' h:mm a"
): string {
  return format(inVenueTz(date, timezone), fmt);
}

/** Duration of [start, end) in fractional hours. */
export function durationHours(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 3_600_000;
}

/**
 * Whole calendar days (venue-local) from `from` until `until`.
 * "How many days before the event is it now?" for cancellation tiers
 * and balance due dates. Same local day => 0.
 */
export function calendarDaysUntil(
  from: Date,
  until: Date,
  timezone: string
): number {
  const a = inVenueTz(from, timezone);
  const b = inVenueTz(until, timezone);
  const aDay = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bDay = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((bDay - aDay) / 86_400_000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Half-open interval overlap test: [aStart,aEnd) ∩ [bStart,bEnd) ≠ ∅ */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
