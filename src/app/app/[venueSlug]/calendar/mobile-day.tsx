"use client";

// Phone (< md) week/day view: a week day-strip, space chips, and a vertical
// timeline of the selected day — bookings interleaved with real free windows
// (inside the venue's operating hours) that open the booking drawer
// prefilled. Ends with a per-space availability card for the same day.

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ListFilter, Plus } from "lucide-react";
import { Select } from "@/components/ui/input";
import { EVENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { formatInVenueTz, venueLocalToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  addDaysStr,
  blocksSpace,
  dowOfStr,
  freeWindows,
  longDayTitle,
  operatingWindow,
  STATUS_GROUPS,
  timeRange,
  toneOf,
  weekDays,
  windowPrefill,
  type CalBooking,
  type CalSpace,
  type CalTone,
  type CalView,
  type Interval,
  type OpenHours,
} from "./cal-shared";
import { StatusIcon } from "./cal-ui";
import { TONE_TEXT } from "./day-panel";
import type { NewBookingPrefill } from "./new-booking-dialog";

const DOW_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const CARD_TONE: Record<CalTone, string> = {
  confirmed: "border-primary/25 bg-accent",
  hold: "border-warning-border bg-warning-soft",
  tentative: "border-dashed border-muted-foreground/50 bg-card",
  done: "border-border bg-muted",
};

type Item =
  | { kind: "booking"; at: number; booking: CalBooking }
  | { kind: "free"; at: number; window: Interval };

export function MobileDay({
  slug,
  view,
  today,
  timezone,
  anchor,
  selectedDay,
  onSelectDay,
  spaces,
  bookings,
  openHours,
  spaceFilter,
  onSpaceFilter,
  statusFilter,
  onStatusFilter,
  canManage,
  onBookingClick,
  onBook,
}: {
  slug: string;
  view: CalView;
  today: string;
  timezone: string;
  anchor: string;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  spaces: CalSpace[];
  /** Every loaded booking (filters are applied here). */
  bookings: CalBooking[];
  openHours: OpenHours[];
  spaceFilter: string;
  onSpaceFilter: (id: string) => void;
  statusFilter: CalTone | "";
  onStatusFilter: (v: CalTone | "") => void;
  canManage: boolean;
  onBookingClick: (b: CalBooking) => void;
  onBook: (prefill: NewBookingPrefill) => void;
}) {
  const [showFilters, setShowFilters] = React.useState(false);
  const filtersId = React.useId();
  const week = React.useMemo(() => weekDays(anchor), [anchor]);
  const stripRef = React.useRef<HTMLUListElement>(null);

  // Keep the selected tile visible in the horizontally scrolling strip.
  React.useEffect(() => {
    const strip = stripRef.current;
    const tile = strip?.querySelector<HTMLElement>("[data-selected]");
    if (!strip || !tile) return;
    const left = tile.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + tile.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = left - (strip.clientWidth - tile.offsetWidth) / 2;
    }
  }, [selectedDay]);

  const matches = React.useCallback(
    (b: CalBooking) =>
      (!spaceFilter || b.spaceId === spaceFilter) && (!statusFilter || toneOf(b.status) === statusFilter),
    [spaceFilter, statusFilter]
  );

  const dayRange = React.useCallback(
    (day: string) => ({
      from: venueLocalToUtc(timezone, day, "00:00").getTime(),
      to: venueLocalToUtc(timezone, addDaysStr(day, 1), "00:00").getTime(),
    }),
    [timezone]
  );

  const counts = React.useMemo(
    () =>
      new Map(
        week.map((d) => {
          const { from, to } = dayRange(d);
          return [d, bookings.filter((b) => matches(b) && b.start < to && b.end > from).length];
        })
      ),
    [week, bookings, matches, dayRange]
  );

  const win = React.useMemo(
    () => operatingWindow(timezone, selectedDay, openHours),
    [timezone, selectedDay, openHours]
  );

  // Bookings shown for the day: anything touching the calendar day or the
  // operating window (which may run past midnight).
  const span = React.useMemo(() => {
    const { from, to } = dayRange(selectedDay);
    return { from: Math.min(from, win?.start ?? from), to: Math.max(to, win?.end ?? to) };
  }, [dayRange, selectedDay, win]);

  const dayBookings = React.useMemo(
    () =>
      bookings
        .filter((b) => matches(b) && b.start < span.to && b.end > span.from)
        .sort((a, b) => a.start - b.start),
    [bookings, matches, span]
  );

  // Free windows ignore the status filter: a hidden hold still blocks.
  const busyFor = React.useCallback(
    (spaceId: string | null) =>
      bookings
        .filter((b) => blocksSpace(b) && (spaceId === null || b.spaceId === spaceId))
        .map((b) => ({ start: b.blockedStart, end: b.blockedEnd })),
    [bookings]
  );

  const free = React.useMemo(
    () =>
      win
        ? freeWindows(
            win,
            busyFor(spaceFilter || null),
            spaces.find((s) => s.id === (spaceFilter || spaces[0]?.id))
          )
        : [],
    [win, busyFor, spaceFilter, spaces]
  );

  const items: Item[] = React.useMemo(
    () =>
      [
        ...dayBookings.map((b): Item => ({ kind: "booking", at: b.start, booking: b })),
        ...free.map((w): Item => ({ kind: "free", at: w.start, window: w })),
      ].sort((a, b) => a.at - b.at),
    [dayBookings, free]
  );

  const bookSpaceId = spaceFilter || spaces[0]?.id;
  const otherSpaces = spaceFilter ? spaces.filter((s) => s.id !== spaceFilter) : spaces;
  const hhmm = (t: number) => formatInVenueTz(new Date(t), timezone, "h:mm a");

  return (
    <div className="space-y-5">
      {/* Week day strip */}
      <nav aria-label="Days this week" className="-mx-4 border-y border-border px-4 py-4">
        <ul ref={stripRef} className="flex gap-2 overflow-x-auto pb-1">
          {week.map((d) => {
            const sel = d === selectedDay;
            const n = counts.get(d) ?? 0;
            const tileCls = cn(
              "flex h-[4.5rem] min-w-[4.25rem] flex-col items-center justify-center rounded-xl border px-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              sel
                ? "border-primary bg-accent text-primary"
                : "border-border bg-card text-foreground hover:bg-muted"
            );
            const label = `${longDayTitle(d)}${n ? `, ${n} event${n === 1 ? "" : "s"}` : ""}`;
            const content = (
              <>
                <span className={cn("text-xs font-medium", sel ? "text-primary" : "text-muted-foreground")}>
                  {DOW_ABBR[dowOfStr(d)]}
                </span>
                <span className={cn("text-xl font-semibold tabular-nums", d === today && !sel && "text-primary")}>
                  {Number(d.slice(8, 10))}
                </span>
                <span className="h-4 text-[11px] leading-4 text-muted-foreground">
                  {n ? `${n} event${n === 1 ? "" : "s"}` : ""}
                </span>
              </>
            );
            return (
              <li key={d} className="shrink-0" data-selected={sel ? "" : undefined}>
                {view === "day" ? (
                  <Link
                    href={`/app/${slug}/calendar?view=day&date=${d}`}
                    scroll={false}
                    aria-label={label}
                    aria-current={sel ? "date" : undefined}
                    className={tileCls}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectDay(d)}
                    aria-label={label}
                    aria-pressed={sel}
                    className={tileCls}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Selected day + filters */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">Selected day · {timezone}</p>
            <h2 className="text-lg font-semibold text-foreground">
              {longDayTitle(selectedDay)}
              {selectedDay === today && (
                <span className="ml-2 rounded-md bg-primary px-1.5 py-0.5 align-middle text-xs font-medium text-primary-foreground">
                  Today
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls={filtersId}
            aria-label="Status filter"
            className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ListFilter className="h-5 w-5" aria-hidden />
            {statusFilter && <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />}
          </button>
        </div>
        <div id={filtersId} hidden={!showFilters} className="mt-3">
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => onStatusFilter(e.target.value as CalTone | "")}
          >
            <option value="">All statuses</option>
            {STATUS_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        </div>

        <ul aria-label="Filter by space" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: "", name: "All spaces" }, ...spaces].map((s) => {
            const on = spaceFilter === s.id;
            return (
              <li key={s.id || "all"} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSpaceFilter(s.id)}
                  className={cn(
                    "inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  )}
                >
                  {s.name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Inline legend */}
      <ul
        aria-label="Legend"
        className="flex flex-wrap gap-x-5 gap-y-1 border-y border-border py-3 text-sm text-muted-foreground"
      >
        <li className="inline-flex items-center gap-1.5">
          <StatusIcon status="CONFIRMED" className="text-primary" /> Confirmed
        </li>
        <li className="inline-flex items-center gap-1.5">
          <StatusIcon status="PENCILED" className="text-warning" /> Penciled
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-dashed border-primary/60 text-primary">
            <Plus className="h-2.5 w-2.5" aria-hidden />
          </span>
          Free
        </li>
      </ul>

      {/* Day timeline */}
      <ol aria-label={`Schedule for ${longDayTitle(selectedDay)}`} className="relative">
        {(!win || items[0]?.at !== win.start) && (
          <TimeRow label={win ? hhmm(win.start) : "—"}>
            <p className="py-2 text-sm text-muted-foreground">
              {win ? "Opens" : "Closed per your operating hours"}
            </p>
          </TimeRow>
        )}
        {items.map((it) =>
          it.kind === "booking" ? (
            <TimeRow key={`b-${it.booking.id}`} label={hhmm(it.booking.start)}>
              <BookingCard booking={it.booking} timezone={timezone} onClick={() => onBookingClick(it.booking)} />
            </TimeRow>
          ) : (
            <TimeRow key={`f-${it.window.start}`} label={hhmm(it.window.start)}>
              <FreeCard
                window={it.window}
                timezone={timezone}
                allSpaces={!spaceFilter && spaces.length > 1}
                onBook={canManage && bookSpaceId ? () => onBook(windowPrefill(timezone, it.window, bookSpaceId)) : undefined}
              />
            </TimeRow>
          )
        )}
        {win && (
          <TimeRow label={hhmm(win.end)}>
            <p className="py-2 text-sm text-muted-foreground">Closes</p>
          </TimeRow>
        )}
      </ol>

      {/* Other spaces' availability */}
      {otherSpaces.length > 0 && (
        <section
          aria-labelledby="cal-other-spaces"
          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <h2 id="cal-other-spaces" className="text-base font-semibold text-foreground">
            {spaceFilter ? "Check another space" : "Space availability"}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Compare availability before quoting a new booking.</p>
          <ul className="mt-3 divide-y divide-border">
            {otherSpaces.map((s) => {
              const busy = win
                ? bookings
                    .filter((b) => b.spaceId === s.id && blocksSpace(b) && b.blockedEnd > win.start && b.blockedStart < win.end)
                    .sort((a, b) => a.start - b.start)
                : [];
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSpaceFilter(s.id)}
                    aria-label={`Show ${s.name}`}
                    className="flex min-h-14 w-full items-center gap-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">{s.name}</span>
                      {!win ? (
                        <span className="block text-sm text-muted-foreground">Closed</span>
                      ) : busy.length === 0 ? (
                        <span className="block text-sm text-muted-foreground">Free all day</span>
                      ) : (
                        busy.slice(0, 2).map((b) => (
                          <span key={b.id} className="block truncate text-sm text-muted-foreground">
                            {timeRange(b.start, b.end, timezone)} ·{" "}
                            {b.status === "CONFIRMED" ? "booked" : STATUS_LABELS[b.status].toLowerCase()} for{" "}
                            {b.clientName}
                          </span>
                        ))
                      )}
                      {busy.length > 2 && (
                        <span className="block text-sm text-muted-foreground">+{busy.length - 2} more</span>
                      )}
                    </span>
                    {win &&
                      (busy.length === 0 ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-label="Free" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 shrink-0 text-warning" aria-label="Has bookings" />
                      ))}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function TimeRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-[4.25rem] shrink-0 pt-2.5 text-xs tabular-nums text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1 border-l border-border pb-3 pl-3">{children}</div>
    </li>
  );
}

function BookingCard({
  booking: b,
  timezone,
  onClick,
}: {
  booking: CalBooking;
  timezone: string;
  onClick: () => void;
}) {
  const tone = toneOf(b.status);
  const setup =
    b.blockedStart < b.start ? `setup ${formatInVenueTz(new Date(b.blockedStart), timezone, "h:mm a")}` : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-3.5 text-left transition-colors hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        CARD_TONE[tone]
      )}
    >
      <span className="flex items-center gap-2">
        <StatusIcon status={b.status} className={cn("h-4 w-4", TONE_TEXT[tone])} />
        <span className="min-w-0 truncate font-semibold text-foreground">{b.clientName}</span>
      </span>
      <span className="mt-1 block truncate text-sm text-muted-foreground">
        {[b.spaceName, setup, EVENT_TYPE_LABELS[b.eventType]].filter(Boolean).join(" · ")}
      </span>
      <span className={cn("mt-1 block text-sm font-medium", TONE_TEXT[tone])}>
        {timeRange(b.start, b.end, timezone)} · {STATUS_LABELS[b.status]}
      </span>
    </button>
  );
}

function FreeCard({
  window: w,
  timezone,
  allSpaces,
  onBook,
}: {
  window: Interval;
  timezone: string;
  allSpaces: boolean;
  onBook?: () => void;
}) {
  const range = timeRange(w.start, w.end, timezone);
  const body = (
    <>
      <Plus className="h-5 w-5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0">
        <span className="block font-semibold text-foreground">
          Free window{allSpaces ? " · every space" : ""}
        </span>
        <span className="block text-sm text-muted-foreground">
          {range}
          {onBook ? " · tap to book" : ""}
        </span>
      </span>
    </>
  );
  const cls =
    "flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-card p-3.5 text-left";
  return onBook ? (
    <button
      type="button"
      onClick={onBook}
      aria-label={`Free window ${range}, tap to book`}
      className={cn(cls, "transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring")}
    >
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
