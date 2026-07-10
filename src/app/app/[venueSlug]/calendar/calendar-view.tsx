"use client";

// Owner calendar: month grid, week/day space-row timelines, fast phone
// booking, click/drag rescheduling. All day boundaries are computed in the
// venue's timezone via @/lib/time.

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EVENT_TYPE_LABELS, STATUS_BAR_COLORS, STATUS_LABELS } from "@/lib/labels";
import { formatInVenueTz, venueLocalToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  addDaysStr,
  addMonthsStr,
  dayHeaderLabel,
  dayTitle,
  HOUR_START,
  HOURS_VISIBLE,
  isTentative,
  minutesToTimeStr,
  monthGridDays,
  monthTitle,
  textOn,
  weekDays,
  weekTitle,
  type CalBooking,
  type CalSpace,
  type CalView,
  type MoveTarget,
} from "./cal-shared";
import { BookingDialog } from "./booking-dialog";
import { NewBookingDialog, type NewBookingPrefill } from "./new-booking-dialog";

const LEGEND_STATUSES = [
  "INQUIRY",
  "QUOTE_SENT",
  "HOLD",
  "PENCILED",
  "CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
] as const;

export interface CalendarViewProps {
  slug: string;
  timezone: string;
  currency: string;
  view: CalView;
  anchor: string;
  today: string;
  spaces: CalSpace[];
  bookings: CalBooking[];
  canManage: boolean;
}

export function CalendarView(props: CalendarViewProps) {
  const { slug, timezone, view, anchor, today, spaces, canManage } = props;
  const router = useRouter();

  const [newPrefill, setNewPrefill] = React.useState<NewBookingPrefill | null>(null);
  const [selected, setSelected] = React.useState<CalBooking | null>(null);
  const [movePrefill, setMovePrefill] = React.useState<MoveTarget | null>(null);

  const navigate = React.useCallback(
    (v: CalView, date: string) => {
      router.push(`/app/${slug}/calendar?view=${v}&date=${date}`);
    },
    [router, slug]
  );

  function step(dir: -1 | 1) {
    if (view === "month") navigate(view, addMonthsStr(anchor, dir));
    else if (view === "week") navigate(view, addDaysStr(anchor, 7 * dir));
    else navigate(view, addDaysStr(anchor, dir));
  }

  const title =
    view === "month"
      ? monthTitle(anchor)
      : view === "week"
        ? weekTitle(addDaysStr(anchor, 0 - dowOf(anchor)))
        : dayTitle(anchor);

  function openBookingAt(prefill: NewBookingPrefill) {
    if (!canManage) return;
    setNewPrefill(prefill);
  }

  function openMove(booking: CalBooking, target: MoveTarget) {
    setSelected(booking);
    setMovePrefill(target);
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 shadow-sm">
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => navigate(v, anchor)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                view === v ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous" onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(view, today)}>
            Today
          </Button>
          <Button variant="outline" size="icon" aria-label="Next" onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>

        {canManage && (
          <Button
            className="ml-auto"
            size="sm"
            onClick={() =>
              openBookingAt({
                date: view === "month" ? today : anchor,
                spaceId: spaces[0]?.id,
                startTime: "18:00",
                endTime: "22:00",
              })
            }
          >
            <CalendarPlus className="h-4 w-4" />
            New booking
          </Button>
        )}
      </div>

      {spaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          Add a space first — the calendar shows one row per space.
        </div>
      ) : view === "month" ? (
        <MonthGrid
          {...props}
          onDayClick={(day) => openBookingAt({ date: day, spaceId: spaces[0]?.id })}
          onMore={(day) => navigate("day", day)}
          onBookingClick={setSelected}
        />
      ) : (
        <Timeline
          {...props}
          days={view === "week" ? weekDays(anchor) : [anchor]}
          onSlotClick={(spaceId, date, startTime, endTime, endsNextDay) =>
            openBookingAt({ spaceId, date, startTime, endTime, endsNextDay })
          }
          onBookingClick={setSelected}
          onBookingDrop={openMove}
        />
      )}

      <Legend spaces={spaces} showSpaces={view === "month"} />

      <NewBookingDialog
        slug={slug}
        timezone={timezone}
        spaces={spaces}
        prefill={newPrefill}
        onClose={() => setNewPrefill(null)}
      />
      <BookingDialog
        slug={slug}
        timezone={timezone}
        currency={props.currency}
        spaces={spaces}
        booking={selected}
        movePrefill={movePrefill}
        canManage={canManage}
        onClose={() => {
          setSelected(null);
          setMovePrefill(null);
        }}
      />
    </div>
  );
}

function dowOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ---------------------------------------------------------------------------
// Month view
// ---------------------------------------------------------------------------

function MonthGrid({
  timezone,
  anchor,
  today,
  spaces,
  bookings,
  onDayClick,
  onMore,
  onBookingClick,
}: CalendarViewProps & {
  onDayClick: (day: string) => void;
  onMore: (day: string) => void;
  onBookingClick: (b: CalBooking) => void;
}) {
  const days = React.useMemo(() => monthGridDays(anchor), [anchor]);
  const spaceColor = React.useMemo(
    () => new Map(spaces.map((s) => [s.id, s.color])),
    [spaces]
  );

  // booking → every venue-local day it overlaps.
  const byDay = React.useMemo(() => {
    const map = new Map<string, CalBooking[]>();
    const bounds = days.map((d) => ({
      day: d,
      from: venueLocalToUtc(timezone, d, "00:00").getTime(),
      to: venueLocalToUtc(timezone, addDaysStr(d, 1), "00:00").getTime(),
    }));
    for (const b of bookings) {
      for (const { day, from, to } of bounds) {
        if (b.start < to && b.end > from) {
          const list = map.get(day) ?? [];
          list.push(b);
          map.set(day, list);
        }
      }
    }
    return map;
  }, [bookings, days, timezone]);

  const anchorMonth = anchor.slice(0, 7);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-medium uppercase tracking-wide text-zinc-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const inMonth = day.slice(0, 7) === anchorMonth;
          const isToday = day === today;
          const dayBookings = byDay.get(day) ?? [];
          const shown = dayBookings.slice(0, 3);
          const extra = dayBookings.length - shown.length;
          return (
            <div
              key={day}
              role="button"
              tabIndex={0}
              onClick={() => onDayClick(day)}
              onKeyDown={(e) => e.key === "Enter" && onDayClick(day)}
              className={cn(
                "min-h-24 cursor-pointer border-b border-zinc-100 p-1.5 transition-colors hover:bg-indigo-50/40 sm:min-h-28",
                i % 7 !== 0 && "border-l",
                !inMonth && "bg-zinc-50/60"
              )}
            >
              <span
                className={cn(
                  "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isToday
                    ? "bg-indigo-600 text-white"
                    : inMonth
                      ? "text-zinc-700"
                      : "text-zinc-400"
                )}
              >
                {Number(day.slice(8, 10))}
              </span>
              <div className="space-y-1">
                {shown.map((b) => {
                  const color = spaceColor.get(b.spaceId) ?? "#4f46e5";
                  const tentative = isTentative(b.status);
                  return (
                    <button
                      key={`${b.id}-${day}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookingClick(b);
                      }}
                      title={`${b.clientName} — ${EVENT_TYPE_LABELS[b.eventType]} (${STATUS_LABELS[b.status]})`}
                      className={cn(
                        "flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-zinc-800",
                        tentative && "border border-dashed opacity-70"
                      )}
                      style={{
                        backgroundColor: `${color}22`,
                        borderLeft: tentative ? undefined : `3px solid ${color}`,
                        borderColor: tentative ? color : undefined,
                      }}
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: STATUS_BAR_COLORS[b.status] }}
                      />
                      <span className="truncate">
                        {formatInVenueTz(new Date(b.start), timezone, "h:mma").toLowerCase()}{" "}
                        {b.clientName}
                      </span>
                    </button>
                  );
                })}
                {extra > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMore(day);
                    }}
                    className="w-full rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    +{extra} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week / day timeline: rows = spaces, x-axis = 6:00 → 2:00 next day
// ---------------------------------------------------------------------------

const LABEL_W = 128;

function Timeline({
  timezone,
  today,
  spaces,
  bookings,
  canManage,
  days,
  onSlotClick,
  onBookingClick,
  onBookingDrop,
}: CalendarViewProps & {
  days: string[];
  onSlotClick: (
    spaceId: string,
    date: string,
    startTime: string,
    endTime: string,
    endsNextDay: boolean
  ) => void;
  onBookingClick: (b: CalBooking) => void;
  onBookingDrop: (b: CalBooking, target: MoveTarget) => void;
}) {
  const isDay = days.length === 1;
  const pph = isDay ? 46 : 13; // px per hour
  const dayW = HOURS_VISIBLE * pph;

  const windows = React.useMemo(
    () =>
      days.map((d) => ({
        day: d,
        start: venueLocalToUtc(timezone, d, "06:00").getTime(),
        end: venueLocalToUtc(timezone, addDaysStr(d, 1), "02:00").getTime(),
      })),
    [days, timezone]
  );

  const bySpace = React.useMemo(() => {
    const map = new Map<string, CalBooking[]>();
    for (const b of bookings) {
      const list = map.get(b.spaceId) ?? [];
      list.push(b);
      map.set(b.spaceId, list);
    }
    return map;
  }, [bookings]);

  /** Pointer x within a day cell → venue-local slot (snapped). */
  function slotFromOffset(day: string, x: number, snapMins: number) {
    const rawMins = HOUR_START * 60 + (x / pph) * 60;
    let mins = Math.round(rawMins / snapMins) * snapMins;
    let date = day;
    if (mins >= 1440) {
      mins -= 1440;
      date = addDaysStr(day, 1);
    }
    return { date, mins };
  }

  function handleCellClick(spaceId: string, day: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const { date, mins } = slotFromOffset(day, e.clientX - rect.left, 30);
    const endMins = mins + 120;
    onSlotClick(
      spaceId,
      date,
      minutesToTimeStr(mins),
      minutesToTimeStr(endMins),
      endMins >= 1440
    );
  }

  function handleDrop(spaceId: string, day: string, e: React.DragEvent<HTMLDivElement>) {
    const id = e.dataTransfer.getData("text/venuora-booking");
    const b = bookings.find((x) => x.id === id);
    if (!b) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const { date, mins } = slotFromOffset(day, e.clientX - rect.left, 15);
    const durMins = Math.max(15, Math.round((b.end - b.start) / 60_000 / 15) * 15);
    const endMins = mins + durMins;
    onBookingDrop(b, {
      spaceId,
      date,
      startTime: minutesToTimeStr(mins),
      endTime: minutesToTimeStr(endMins),
      endsNextDay: endMins >= 1440,
    });
  }

  const hourMarks = Array.from(
    { length: HOURS_VISIBLE / 2 + 1 },
    (_, i) => HOUR_START + i * 2
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div style={{ minWidth: LABEL_W + days.length * dayW }}>
        {/* Header: day labels (+ hour ticks) */}
        <div className="flex border-b border-zinc-200 bg-zinc-50">
          <div
            className="sticky left-0 z-20 shrink-0 border-r border-zinc-200 bg-zinc-50"
            style={{ width: LABEL_W }}
          />
          {days.map((d) => (
            <div key={d} className="shrink-0 border-r border-zinc-200 last:border-r-0" style={{ width: dayW }}>
              <p
                className={cn(
                  "px-2 pt-1.5 text-xs font-semibold",
                  d === today ? "text-indigo-600" : "text-zinc-700"
                )}
              >
                {dayHeaderLabel(d)}
              </p>
              <div className="relative h-4">
                {hourMarks.map((h) => (
                  <span
                    key={h}
                    className="absolute top-0 text-[10px] text-zinc-400"
                    style={{ left: (h - HOUR_START) * pph + 2 }}
                  >
                    {isDay || h % 6 === 0 ? hourLabel(h) : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Space rows */}
        {spaces.map((space) => (
          <div key={space.id} className="flex border-b border-zinc-100 last:border-b-0">
            <div
              className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-zinc-200 bg-white px-3"
              style={{ width: LABEL_W }}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: space.color }}
              />
              <span className="truncate text-sm font-medium text-zinc-800">{space.name}</span>
            </div>

            <div className="relative flex h-16" style={{ width: days.length * dayW }}>
              {/* Day cells (click + drop targets) */}
              {windows.map(({ day }) => (
                <div
                  key={day}
                  className={cn(
                    "h-full shrink-0 border-r border-zinc-100 last:border-r-0",
                    canManage && "cursor-pointer hover:bg-indigo-50/40"
                  )}
                  style={{
                    width: dayW,
                    backgroundImage: `repeating-linear-gradient(to right, #f4f4f5 0 1px, transparent 1px ${pph * 2}px)`,
                  }}
                  onClick={canManage ? (e) => handleCellClick(space.id, day, e) : undefined}
                  onDragOver={
                    canManage
                      ? (e) => {
                          if (e.dataTransfer.types.includes("text/venuora-booking"))
                            e.preventDefault();
                        }
                      : undefined
                  }
                  onDrop={canManage ? (e) => handleDrop(space.id, day, e) : undefined}
                />
              ))}

              {/* Booking bars, clipped per day window */}
              {(bySpace.get(space.id) ?? []).flatMap((b) =>
                windows.map(({ day, start: winStart, end: winEnd }, di) => {
                  const segStart = Math.max(b.blockedStart, winStart);
                  const segEnd = Math.min(b.blockedEnd, winEnd);
                  if (segEnd <= segStart) return null;
                  return (
                    <BookingBar
                      key={`${b.id}-${day}`}
                      booking={b}
                      left={di * dayW + ((segStart - winStart) / 3_600_000) * pph}
                      width={((segEnd - segStart) / 3_600_000) * pph}
                      segStart={segStart}
                      segEnd={segEnd}
                      pph={pph}
                      clippedLeft={b.blockedStart < winStart}
                      clippedRight={b.blockedEnd > winEnd}
                      draggable={canManage && !isTentative(b.status)}
                      onClick={() => onBookingClick(b)}
                    />
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function hourLabel(h: number): string {
  const hh = h % 24;
  if (hh === 0) return "12am";
  if (hh === 12) return "12pm";
  return hh < 12 ? `${hh}am` : `${hh - 12}pm`;
}

function BookingBar({
  booking: b,
  left,
  width,
  segStart,
  segEnd,
  pph,
  clippedLeft,
  clippedRight,
  draggable,
  onClick,
}: {
  booking: CalBooking;
  left: number;
  width: number;
  segStart: number;
  segEnd: number;
  pph: number;
  clippedLeft: boolean;
  clippedRight: boolean;
  draggable: boolean;
  onClick: () => void;
}) {
  const color = STATUS_BAR_COLORS[b.status];
  const tentative = isTentative(b.status);
  const px = (ms: number) => (ms / 3_600_000) * pph;

  // Buffer zones (setup before start / teardown after end), clipped to segment.
  const setupW = px(Math.max(0, Math.min(b.start, segEnd) - segStart));
  const teardownW = px(Math.max(0, segEnd - Math.max(b.end, segStart)));
  const hatch = {
    backgroundImage: `repeating-linear-gradient(45deg, ${color}66 0 4px, transparent 4px 8px)`,
  };

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/venuora-booking", b.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          onClick();
        }
      }}
      title={`${b.clientName} — ${EVENT_TYPE_LABELS[b.eventType]} (${STATUS_LABELS[b.status]})`}
      className={cn(
        "absolute top-2 bottom-2 z-10 overflow-hidden rounded-md text-[11px] leading-tight shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        draggable && "cursor-grab active:cursor-grabbing",
        !draggable && "cursor-pointer",
        tentative && "border-2 border-dashed"
      )}
      style={{
        left,
        width: Math.max(width, 8),
        backgroundColor: tentative ? `${color}33` : `${color}26`,
        borderColor: tentative ? color : undefined,
      }}
    >
      {/* setup buffer hatch */}
      {setupW > 0 && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0"
          style={{ width: setupW, ...hatch }}
        />
      )}
      {/* teardown buffer hatch */}
      {teardownW > 0 && (
        <span
          aria-hidden
          className="absolute inset-y-0 right-0"
          style={{ width: teardownW, ...hatch }}
        />
      )}
      {/* event core */}
      <span
        aria-hidden
        className="absolute inset-y-0 rounded-sm"
        style={{
          left: setupW,
          right: teardownW,
          backgroundColor: tentative ? "transparent" : color,
          opacity: tentative ? 0 : 0.9,
        }}
      />
      <span
        className="absolute inset-y-0 flex items-center gap-0.5 truncate px-1.5 font-medium"
        style={{
          left: setupW,
          right: teardownW,
          color: tentative ? "#3f3f46" : textOn(color),
        }}
      >
        {clippedLeft && <span aria-hidden>‹</span>}
        <span className="truncate">
          {b.clientName} — {EVENT_TYPE_LABELS[b.eventType]}
        </span>
        {clippedRight && <span aria-hidden>›</span>}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function Legend({ spaces, showSpaces }: { spaces: CalSpace[]; showSpaces: boolean }) {
  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 text-xs text-zinc-600 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-semibold uppercase tracking-wide text-zinc-400">Status</span>
        {LEGEND_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: STATUS_BAR_COLORS[s] }}
            />
            {STATUS_LABELS[s]}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-semibold uppercase tracking-wide text-zinc-400">Key</span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-3 w-6 rounded-sm"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #71717aa0 0 4px, transparent 4px 8px)",
            }}
          />
          Setup / teardown buffer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-6 rounded-sm border-2 border-dashed border-sky-400 bg-sky-100" />
          Inquiry / quote — doesn&apos;t block the slot
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="font-semibold">‹ ›</span>
          Continues past the visible edge
        </span>
      </div>
      {showSpaces && spaces.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-semibold uppercase tracking-wide text-zinc-400">Spaces</span>
          {spaces.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
