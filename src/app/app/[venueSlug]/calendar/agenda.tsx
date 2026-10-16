"use client";

// Mobile (< md) agenda: the visible range as a day-grouped list of tappable
// rows. Empty days are omitted.

import * as React from "react";
import { StatusBadge } from "@/components/ui/badge";
import { formatInVenueTz, venueDateStr } from "@/lib/time";
import { cn } from "@/lib/utils";
import { longDayTitle, toneOf, type CalBooking } from "./cal-shared";
import { SpaceDot } from "./cal-ui";

const TONE_EDGE = {
  confirmed: "border-l-primary",
  hold: "border-l-[#c98a1b]",
  tentative: "border-l-[#8b8797] border-dashed",
  done: "border-l-[#bdb8ad]",
} as const;

export function Agenda({
  timezone,
  today,
  days,
  bookings,
  spaceColor,
  onBookingClick,
  empty,
}: {
  timezone: string;
  today: string;
  /** Venue-local days in range (ascending). */
  days: string[];
  bookings: CalBooking[];
  spaceColor: Map<string, string>;
  onBookingClick: (b: CalBooking) => void;
  empty: React.ReactNode;
}) {
  const groups = React.useMemo(() => {
    const first = days[0];
    const last = days[days.length - 1];
    const inRange = new Set(days);
    const map = new Map<string, CalBooking[]>();
    for (const b of bookings) {
      const startDay = venueDateStr(new Date(b.start), timezone);
      const endDay = venueDateStr(new Date(b.end - 1), timezone);
      // Started before the range but still running inside it → first day.
      let day = startDay;
      if (startDay < first && endDay >= first) day = first;
      if (!inRange.has(day) || day > last) continue;
      const list = map.get(day) ?? [];
      list.push(b);
      map.set(day, list);
    }
    return days
      .filter((d) => map.has(d))
      .map((d) => ({ day: d, items: map.get(d)!.sort((a, b) => a.start - b.start) }));
  }, [bookings, days, timezone]);

  if (groups.length === 0) {
    return <div className="rounded-xl border border-border bg-card">{empty}</div>;
  }

  return (
    <div className="space-y-5">
      {groups.map(({ day, items }) => (
        <section key={day} aria-labelledby={`ag-${day}`}>
          <h3
            id={`ag-${day}`}
            className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            {longDayTitle(day)}
            {day === today && (
              <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                Today
              </span>
            )}
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {items.map((b) => {
              const sameDay =
                venueDateStr(new Date(b.start), timezone) === venueDateStr(new Date(b.end), timezone);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onBookingClick(b)}
                    className={cn(
                      "flex min-h-16 w-full items-start gap-3 border-l-4 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      TONE_EDGE[toneOf(b.status)]
                    )}
                  >
                    <span className="w-[4.5rem] shrink-0 text-sm tabular-nums">
                      <span className="block font-semibold text-foreground">
                        {formatInVenueTz(new Date(b.start), timezone, "h:mm a")}
                      </span>
                      <span className="block text-muted-foreground">
                        {formatInVenueTz(new Date(b.end), timezone, sameDay ? "h:mm a" : "EEE h:mm a")}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{b.clientName}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <SpaceDot color={spaceColor.get(b.spaceId) ?? "#5145ae"} />
                        <span className="truncate">{b.spaceName}</span>
                      </span>
                    </span>
                    <StatusBadge status={b.status} className="mt-0.5 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
