"use client";

import * as React from "react";
import { EVENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { formatInVenueTz, venueLocalToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  addDaysStr, dayHeaderLabel, HOUR_START, HOURS_VISIBLE, isTentative,
  minutesToTimeStr, timeRange, toneOf,
  type CalBooking, type CalSpace, type MoveTarget,
} from "./cal-shared";
import { hatchStyle, StatusIcon } from "./cal-ui";
import { MONTH_CHIP } from "./month-grid";
import { clockMinutes, clockSpan, packLanes, verticalSlot } from "./timeline-layout";

const HOUR_HEIGHT = 48;
const HEIGHT = HOURS_VISIBLE * HOUR_HEIGHT;
const minutePosition = (minute: number) => (minute - HOUR_START * 60) * HOUR_HEIGHT / 60;
const subscribeMinute = (callback: () => void) => {
  const timer = setInterval(callback, 30_000);
  return () => clearInterval(timer);
};
const getNow = () => Math.floor(Date.now() / 60_000) * 60_000;
const getServerNow = () => null;

export function Timeline({ timezone, today, spaces, bookings, canManage, days, onSlotClick, onBookingClick, onBookingDrop, footer }: {
  timezone: string;
  today: string;
  spaces: CalSpace[];
  bookings: CalBooking[];
  canManage: boolean;
  days: string[];
  onSlotClick: (spaceId: string, date: string, startTime: string, endTime: string, endsNextDay: boolean) => void;
  onBookingClick: (booking: CalBooking) => void;
  onBookingDrop: (booking: CalBooking, target: MoveTarget) => void;
  footer?: React.ReactNode;
}) {
  const isDay = days.length === 1;
  const now = React.useSyncExternalStore(subscribeMinute, getNow, getServerNow);
  const columns = isDay
    ? spaces.map((space) => ({ key: space.id, day: days[0], space, title: space.name }))
    : days.map((day) => ({ key: day, day, space: null, title: dayHeaderLabel(day) }));
  const template = `56px repeat(${Math.max(1, columns.length)}, minmax(${isDay ? 180 : 112}px, 1fr))`;

  function bookAt(spaceId: string, day: string, fraction: number) {
    const slot = verticalSlot(day, fraction);
    onSlotClick(spaceId, slot.date, slot.time, minutesToTimeStr(slot.minutes + 120), slot.minutes + 120 >= 1440);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <div style={{ minWidth: 56 + columns.length * (isDay ? 180 : 112) }}>
          <div className="grid border-b border-border bg-background" style={{ gridTemplateColumns: template }}>
            <span className="flex items-center justify-center border-r border-border text-[10px] uppercase tracking-wide text-muted-foreground">Time</span>
            {columns.map((column) => <div key={column.key} className={cn("border-r border-border px-3 py-3 last:border-r-0", column.day === today && !isDay && "bg-accent/25 text-primary")}>
              <p className="text-xs font-medium">{column.title}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{isDay ? "Venue local time" : `${bookings.filter((booking) => clockMinutes(booking.start, column.day, timezone) >= 0 && clockMinutes(booking.start, column.day, timezone) < 1440).length} events`}</p>
            </div>)}
          </div>
          <div className="grid" style={{ gridTemplateColumns: template }}>
            <div className="relative border-r border-border bg-background" style={{ height: HEIGHT }}>
              {Array.from({ length: HOURS_VISIBLE + 1 }, (_, index) => <span key={index} className="absolute right-2 text-[10px] tabular-nums text-muted-foreground" style={{ top: index * HOUR_HEIGHT, transform: index === HOURS_VISIBLE ? "translateY(-100%)" : "translateY(-35%)" }}>{minutesToTimeStr((HOUR_START + index) * 60)}</span>)}
            </div>
            {columns.map((column) => {
              const windowStart = venueLocalToUtc(timezone, column.day, "06:00").getTime();
              const windowEnd = venueLocalToUtc(timezone, addDaysStr(column.day, 1), "02:00").getTime();
              const matching = bookings.filter((booking) => (!column.space || booking.spaceId === column.space.id) && booking.blockedStart < windowEnd && booking.blockedEnd > windowStart);
              const placements = packLanes(matching.map((booking) => ({ id: booking.id, start: Math.max(booking.blockedStart, windowStart), end: Math.min(booking.blockedEnd, windowEnd) })));
              const currentMinute = now === null ? null : clockMinutes(now, column.day, timezone);
              return <div key={column.key} className={cn("relative border-r border-border last:border-r-0", column.day === today && "bg-accent/10")} style={{ height: HEIGHT, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_HEIGHT - 1}px, var(--border) ${HOUR_HEIGHT - 1}px ${HOUR_HEIGHT}px)` }}
                onDragOver={canManage ? (event) => { if (event.dataTransfer.types.includes("text/venuora-booking")) event.preventDefault(); } : undefined}
                onDrop={canManage ? (event) => {
                  const booking = bookings.find((item) => item.id === event.dataTransfer.getData("text/venuora-booking"));
                  if (!booking || isTentative(booking.status)) return;
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const slot = verticalSlot(column.day, (event.clientY - rect.top) / HEIGHT, 15);
                  const start = venueLocalToUtc(timezone, slot.date, slot.time);
                  const end = new Date(start.getTime() + booking.end - booking.start);
                  onBookingDrop(booking, { spaceId: column.space?.id ?? booking.spaceId, date: slot.date, startTime: slot.time, endTime: formatInVenueTz(end, timezone, "HH:mm"), endsNextDay: formatInVenueTz(end, timezone, "yyyy-MM-dd") > slot.date });
                } : undefined}>
                {canManage && spaces.length > 0 && Array.from({ length: HOURS_VISIBLE * 2 }, (_, index) => <button key={index} type="button" aria-label={`Start a booking on ${column.day} at ${minutesToTimeStr(HOUR_START * 60 + index * 30)}${column.space ? ` in ${column.space.name}` : ""}`} className="absolute left-0 w-full hover:bg-accent/30 focus-visible:z-20 focus-visible:bg-accent/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring" style={{ top: index * HOUR_HEIGHT / 2, height: HOUR_HEIGHT / 2 }} onClick={() => bookAt(column.space?.id ?? spaces[0].id, column.day, index / (HOURS_VISIBLE * 2))} />)}
                {placements.map((placement) => {
                  const booking = matching.find((item) => item.id === placement.id)!;
                  const blocked = clockSpan(placement.start, placement.end, column.day, timezone);
                  const core = clockSpan(booking.start, booking.end, column.day, timezone);
                  const top = Math.max(0, minutePosition(blocked.from));
                  const bottom = Math.min(HEIGHT, minutePosition(blocked.to));
                  const coreTop = Math.min(bottom, Math.max(top, minutePosition(core.from)));
                  const coreBottom = Math.max(top, Math.min(bottom, minutePosition(core.to)));
                  const color = toneOf(booking.status) === "hold" ? "#c98a1b" : "#5145ae";
                  const durationLabel = timeRange(booking.start, booking.end, timezone);
                  return <div key={booking.id} role="button" tabIndex={0} draggable={canManage && !isTentative(booking.status)}
                    aria-label={`${booking.clientName}, ${booking.spaceName}, ${STATUS_LABELS[booking.status]}, ${durationLabel}`}
                    title={`${booking.clientName} · ${booking.spaceName} · ${durationLabel} · ${STATUS_LABELS[booking.status]}`}
                    onDragStart={(event) => { event.dataTransfer.setData("text/venuora-booking", booking.id); event.dataTransfer.effectAllowed = "move"; }}
                    onClick={() => onBookingClick(booking)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onBookingClick(booking); } }}
                    className="absolute z-10 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" style={{ top, height: Math.max(4, bottom - top), left: `calc(${placement.lane / placement.lanes * 100}% + 4px)`, width: `calc(${100 / placement.lanes}% - 8px)` }}>
                    {coreTop > top && <span className="absolute inset-x-0 top-0 overflow-hidden rounded-md px-2 py-1 text-[10px] text-muted-foreground" style={{ height: coreTop - top, ...hatchStyle(color) }}>Setup buffer</span>}
                    {coreBottom > coreTop && <span className={cn("absolute inset-x-0 overflow-hidden rounded-md border-l-[3px] px-2 py-2 text-xs shadow-xs", MONTH_CHIP[toneOf(booking.status)])} style={{ top: coreTop - top, height: Math.max(4, coreBottom - coreTop) }}>
                      <span className="flex items-start gap-1"><span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">{booking.clientName}</span><StatusIcon status={booking.status} className="h-3 w-3" /></span>
                      <span className="mt-1 block text-[10px]">{booking.spaceName}</span><span className="mt-1 block text-[10px]">{durationLabel}</span>
                      {isDay && <span className="mt-1 block text-[10px]">{EVENT_TYPE_LABELS[booking.eventType]}{booking.guestCount ? ` · ${booking.guestCount} guests` : ""}</span>}
                      {booking.holdExpiresAt && <span className="mt-1 block text-[10px]">Expires {formatInVenueTz(new Date(booking.holdExpiresAt), timezone, "MMM d, h:mm a")}</span>}
                    </span>}
                    {bottom > coreBottom && <span className="absolute inset-x-0 bottom-0 overflow-hidden rounded-md px-2 py-1 text-[10px] text-muted-foreground" style={{ height: Math.min(bottom - top, bottom - coreBottom), ...hatchStyle(color) }}>Teardown buffer</span>}
                  </div>;
                })}
                {currentMinute !== null && currentMinute >= HOUR_START * 60 && currentMinute < (HOUR_START + HOURS_VISIBLE) * 60 && <div className="pointer-events-none absolute inset-x-0 z-20 border-t border-destructive" style={{ top: minutePosition(currentMinute) }}><span className="absolute -top-2.5 left-0 rounded-full bg-destructive px-2 py-0.5 text-[10px] text-white">{formatInVenueTz(new Date(now!), timezone, "h:mm a")}</span></div>}
              </div>;
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground"><span>06:00–02:00 the next day · {timezone}</span>{canManage && <span className="ml-auto">Select a time to book · drag a booking to move it</span>}</div>
      {footer}
    </div>
  );
}
