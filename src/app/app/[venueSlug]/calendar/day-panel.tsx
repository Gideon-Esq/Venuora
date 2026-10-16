"use client";

// "Selected day" side panel next to the month grid (md and up): the day's
// bookings as cards, and real free windows per space on demand.

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Clock, Plus, Search, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EVENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { formatInVenueTz } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  blocksSpace,
  freeWindows,
  operatingWindow,
  parseDateStr,
  dowOfStr,
  timeRange,
  toneOf,
  windowPrefill,
  type CalBooking,
  type CalSpace,
  type CalTone,
  type OpenHours,
} from "./cal-shared";
import { StatusIcon } from "./cal-ui";
import type { NewBookingPrefill } from "./new-booking-dialog";

const DOWS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Status label colour per tone (cards). */
export const TONE_TEXT: Record<CalTone, string> = {
  confirmed: "text-primary",
  hold: "text-warning",
  tentative: "text-muted-foreground",
  done: "text-muted-foreground",
};

export function DayPanel({
  slug,
  day,
  timezone,
  bookings,
  allBookings,
  spaces,
  openHours,
  canManage,
  onClose,
  onBookingClick,
  onBook,
}: {
  slug: string;
  day: string;
  timezone: string;
  /** The day's bookings after filters (sorted by start). */
  bookings: CalBooking[];
  /** Every loaded booking — free windows ignore the status filter. */
  allBookings: CalBooking[];
  /** Spaces in scope (space filter applied). */
  spaces: CalSpace[];
  openHours: OpenHours[];
  canManage: boolean;
  onClose: () => void;
  onBookingClick: (b: CalBooking) => void;
  onBook: (prefill: NewBookingPrefill) => void;
}) {
  const [showFree, setShowFree] = React.useState(false);
  const { m, d } = parseDateStr(day);
  const heading = `${DOWS[dowOfStr(day)]}, ${MONTHS[m - 1]} ${d}`;
  const headingId = React.useId();

  const win = React.useMemo(() => operatingWindow(timezone, day, openHours), [timezone, day, openHours]);
  const freeBySpace = React.useMemo(
    () =>
      spaces.map((s) => ({
        space: s,
        windows: win
          ? freeWindows(
              win,
              allBookings
                .filter((b) => b.spaceId === s.id && blocksSpace(b))
                .map((b) => ({ start: b.blockedStart, end: b.blockedEnd })),
              s
            )
          : [],
      })),
    [spaces, allBookings, win]
  );

  return (
    <aside
      aria-labelledby={headingId}
      className="flex w-56 shrink-0 flex-col rounded-xl border border-border bg-card p-4 lg:w-80 lg:p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selected day</p>
          <h2 id={headingId} className="mt-1 text-xl font-semibold text-foreground">
            {heading}
          </h2>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close selected day">
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{timezone}</span>
      </p>

      {bookings.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-center">
          <p className="text-sm font-medium text-foreground">Nothing booked</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {win ? "Check free windows below before choosing a time." : "Closed per your operating hours."}
          </p>
          {canManage && spaces.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => onBook({ date: day, spaceId: spaces[0]?.id })}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Book this day
            </Button>
          )}
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {bookings.map((b) => {
            const tone = toneOf(b.status);
            const expires =
              b.holdExpiresAt && (b.status === "PENCILED" || b.status === "HOLD")
                ? `Expires ${formatInVenueTz(new Date(b.holdExpiresAt), timezone, "MMM d")}`
                : null;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onBookingClick(b)}
                  className="w-full rounded-xl border border-border bg-card p-3.5 text-left shadow-xs transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
                    <span className={cn("inline-flex items-center gap-1.5 font-semibold", TONE_TEXT[tone])}>
                      <StatusIcon status={b.status} />
                      {STATUS_LABELS[b.status]}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {timeRange(b.start, b.end, timezone)}
                    </span>
                  </span>
                  <span className="mt-1.5 block truncate text-base font-semibold text-foreground">
                    {b.spaceName}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {[expires, b.clientName, EVENT_TYPE_LABELS[b.eventType], b.guestCount ? `${b.guestCount} guests` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showFree && (
        <section aria-label="Free windows" className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Free windows</p>
          {!win ? (
            <p className="mt-2 text-sm text-muted-foreground">Closed per your operating hours.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {freeBySpace.map(({ space, windows }) => (
                <li key={space.id}>
                  <p className="text-sm font-medium text-foreground">{space.name}</p>
                  {windows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Fully booked</p>
                  ) : (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {windows.map((w) => {
                        const label = timeRange(w.start, w.end, timezone);
                        return (
                          <li key={w.start}>
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => onBook(windowPrefill(timezone, w, space.id))}
                                aria-label={`Book ${space.name}, ${label}`}
                                className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-2 py-1 text-xs font-medium text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                              >
                                <Plus className="h-3 w-3" aria-hidden />
                                {label}
                              </button>
                            ) : (
                              <span className="inline-block rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
                                {label}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/app/${slug}/calendar?view=day&date=${day}`}
            scroll={false}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            Open day view
          </Link>
        </section>
      )}

      <div className="mt-auto pt-5">
        <button
          type="button"
          onClick={() => setShowFree((v) => !v)}
          aria-expanded={showFree}
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          <Search className="h-4 w-4" aria-hidden />
          {showFree ? "Hide free windows" : "Check free windows"}
        </button>
      </div>
    </aside>
  );
}
