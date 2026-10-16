// Shared (server + client safe) tour helpers used by the Tours page and the
// dashboard. Tours are serialised to plain strings on the server so every
// time is rendered in the venue's timezone, never the browser's.
import type { TourStatus } from "@/generated/prisma/enums";
import type { BadgeVariant } from "@/components/ui/badge";
import { formatInVenueTz, venueDateStr, addDays } from "@/lib/time";

export const TOUR_STATUS_LABELS: Record<TourStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const TOUR_STATUS_VARIANTS: Record<TourStatus, BadgeVariant> = {
  PENDING: "warning",
  CONFIRMED: "success",
  DECLINED: "danger",
  COMPLETED: "muted",
  CANCELLED: "outline",
};

export interface TourView {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: TourStatus;
  spaceName: string | null;
  /** "Today · 3:30 PM", "Tomorrow · 10:00 AM" or "Tue, Jun 18 · 3:30 PM" */
  when: string;
  /** "Tuesday, June 18, 2026 · 3:30 PM – 4:00 PM" */
  whenLong: string;
  /** Requested time is already in the past. */
  isPast: boolean;
}

/** Relative venue-local label for an instant: Today / Tomorrow / weekday date. */
export function relativeVenueDay(date: Date, now: Date, tz: string): string {
  const day = venueDateStr(date, tz);
  if (day === venueDateStr(now, tz)) return "Today";
  if (day === venueDateStr(addDays(now, 1), tz)) return "Tomorrow";
  if (day === venueDateStr(addDays(now, -1), tz)) return "Yesterday";
  const sameYear = day.slice(0, 4) === venueDateStr(now, tz).slice(0, 4);
  return formatInVenueTz(date, tz, sameYear ? "EEE, MMM d" : "EEE, MMM d, yyyy");
}

export function toTourView(
  tour: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    notes: string | null;
    status: TourStatus;
    spaceId: string | null;
    requestedAt: Date;
  },
  ctx: { tz: string; now: Date; spaceNames: Map<string, string> }
): TourView {
  const { tz, now } = ctx;
  const end = new Date(tour.requestedAt.getTime() + 30 * 60_000);
  return {
    id: tour.id,
    name: tour.name,
    email: tour.email,
    phone: tour.phone,
    notes: tour.notes,
    status: tour.status,
    spaceName: tour.spaceId ? (ctx.spaceNames.get(tour.spaceId) ?? null) : null,
    when: `${relativeVenueDay(tour.requestedAt, now, tz)} · ${formatInVenueTz(tour.requestedAt, tz, "h:mm a")}`,
    whenLong: `${formatInVenueTz(tour.requestedAt, tz, "EEEE, MMMM d, yyyy")} · ${formatInVenueTz(
      tour.requestedAt,
      tz,
      "h:mm a"
    )} – ${formatInVenueTz(end, tz, "h:mm a")}`,
    isPast: tour.requestedAt < now,
  };
}
