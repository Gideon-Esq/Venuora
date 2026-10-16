"use client";

// Month view (md and up): Monday-first grid. Chips name the SPACE with a
// status-toned left edge; "+N more" → Day view. Clicking a day selects it in
// the side panel; clicking an empty day also opens the booking drawer.

import * as React from "react";
import Link from "next/link";
import { EVENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { formatInVenueTz } from "@/lib/time";
import { cn } from "@/lib/utils";
import { longDayTitle, monthTitle, toneOf, WEEKDAYS_MON_FIRST, type CalBooking, type CalTone } from "./cal-shared";
import { StatusIcon } from "./cal-ui";

const MAX_CHIPS = 2;

/** Soft tinted chip with a status-coloured left edge. */
export const MONTH_CHIP: Record<CalTone, string> = {
  confirmed: "border-l-primary bg-accent text-accent-foreground",
  hold: "border-l-warning bg-warning-soft text-warning",
  tentative: "border border-dashed border-muted-foreground/50 border-l-muted-foreground bg-card text-muted-foreground",
  done: "border-l-muted-foreground/60 bg-muted text-muted-foreground",
};

export function MonthGrid({
  slug,
  timezone,
  anchor,
  today,
  days,
  byDay,
  selectedDay,
  onDaySelect,
  onBookingClick,
  footer,
  compact = false,
  emptyState,
}: {
  slug: string;
  timezone: string;
  anchor: string;
  today: string;
  days: string[];
  byDay: Map<string, CalBooking[]>;
  selectedDay: string | null;
  onDaySelect: (day: string) => void;
  onBookingClick: (b: CalBooking) => void;
  footer?: React.ReactNode;
  compact?: boolean;
  emptyState?: React.ReactNode;
}) {
  const anchorMonth = anchor.slice(0, 7);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/60">
        {WEEKDAYS_MON_FIRST.map((d) => (
          <div key={d.long} className={cn("py-2.5 text-center font-medium text-muted-foreground", compact ? "px-0 text-[10px]" : "px-2 text-xs uppercase tracking-wide")}>
            <abbr title={d.long} className="no-underline">
              {compact ? d.short : d.long}
            </abbr>
          </div>
        ))}
      </div>
      {!compact && <h2 className="py-4 text-center text-lg font-medium">{monthTitle(anchor)}</h2>}
      <div className={cn("grid grid-cols-7", !compact && "mx-4 border border-border")}>
        {days.map((day, i) => {
          const inMonth = day.slice(0, 7) === anchorMonth;
          const isToday = day === today;
          const isSelected = day === selectedDay;
          const dayBookings = byDay.get(day) ?? [];
          const shown = dayBookings.slice(0, MAX_CHIPS);
          const extra = dayBookings.length - shown.length;
          const dayNum = Number(day.slice(8, 10));
          return (
            <div
              key={day}
              onClick={() => onDaySelect(day)}
              className={cn(
                "relative cursor-pointer border-border transition-colors",
                compact ? "min-h-14 p-1" : "min-h-28 p-1 lg:min-h-32 lg:p-2",
                i % 7 !== 6 && "border-r",
                i < days.length - 7 && "border-b",
                !inMonth && "bg-muted/40",
                isSelected && !compact
                  ? "bg-accent/40 outline-2 -outline-offset-2 outline-primary"
                  : "hover:bg-accent/25"
              )}
            >
              <div className="mb-1.5 flex items-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDaySelect(day);
                  }}
                  aria-label={`${longDayTitle(day)}${dayBookings.length ? `, ${dayBookings.length} booking${dayBookings.length === 1 ? "" : "s"}` : ", nothing booked"}`}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    compact ? "h-6 w-6 text-xs" : "h-7 w-7 text-sm",
                    isSelected
                      ? "bg-primary font-semibold text-primary-foreground"
                      : isToday
                        ? "bg-accent font-semibold text-primary ring-1 ring-primary/40"
                        : inMonth
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                  )}
                >
                  {dayNum}
                </button>
              </div>
              {compact ? <div className="flex justify-center gap-0.5">{dayBookings.slice(0, 3).map((booking) => <span key={booking.id} aria-hidden className={cn("h-1 w-1 rounded-full", toneOf(booking.status) === "hold" ? "bg-warning" : "bg-primary")} />)}</div> : <ul className="space-y-1">
                {shown.map((b) => {
                  const time = formatInVenueTz(new Date(b.start), timezone, "h:mm a");
                  const tone = toneOf(b.status);
                  return (
                    <li key={`${b.id}-${day}`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBookingClick(b);
                        }}
                        title={`${b.spaceName} · ${time} · ${b.clientName} — ${EVENT_TYPE_LABELS[b.eventType]} (${STATUS_LABELS[b.status]})`}
                        aria-label={`${b.spaceName}, ${time}, ${b.clientName}, ${STATUS_LABELS[b.status]}`}
                        className={cn(
                          "flex w-full min-w-0 cursor-pointer items-start gap-1 rounded-md border-l-[3px] px-[3px] py-1 text-left text-[10.5px] lg:px-1.5 lg:py-1.5 lg:text-xs font-medium leading-tight focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                          MONTH_CHIP[tone]
                        )}
                      >
                        {tone !== "confirmed" && <StatusIcon status={b.status} className="mt-px h-3 w-3" />}
                        <span className="line-clamp-3 min-w-0 flex-1 [overflow-wrap:anywhere] lg:line-clamp-2">{b.spaceName}<span className="hidden xl:inline"> · {b.clientName}</span></span>
                      </button>
                    </li>
                  );
                })}
                {extra > 0 && (
                  <li>
                    <Link
                      href={`/app/${slug}/calendar?view=day&date=${day}`}
                      scroll={false}
                      onClick={(e) => e.stopPropagation()}
                      className="block whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      +{extra} more
                    </Link>
                  </li>
                )}
              </ul>}
            </div>
          );
        })}
      </div>
      {emptyState}
      {footer}
    </div>
  );
}
