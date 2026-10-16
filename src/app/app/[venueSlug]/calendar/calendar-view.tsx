"use client";

// Owner calendar: header + filters, month grid / week & day timelines on
// desktop, compact month cells and day schedules on phones, and booking drawers.
// All day boundaries are computed in the venue's timezone via @/lib/time.

import * as React from "react";
import Link from "next/link";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe2,
  Plus,
  SearchX,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { formatInVenueTz, venueLocalToUtc } from "@/lib/time";
import { STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  addDaysStr,
  addMonthsStr,
  dayTitle,
  monthTitle,
  longDayTitle,
  timeRange,
  startOfWeekStr,
  STATUS_GROUPS,
  toneOf,
  visibleDays,
  weekTitle,
  type CalBooking,
  type CalSpace,
  type CalTone,
  type CalView,
  type MoveTarget,
  type OpenHours,
} from "./cal-shared";
import { BookingDialog } from "./booking-dialog";
import { DayPanel } from "./day-panel";
import { LegendPopover } from "./legend";
import { MobileDay } from "./mobile-day";
import { MonthGrid } from "./month-grid";
import { SpaceWeek } from "./space-week";
import { NewBookingDialog, type NewBookingPrefill } from "./new-booking-dialog";
import { PhoneBookingPanel } from "./phone-booking-panel";
import { Timeline } from "./timeline";

export interface CalendarViewProps {
  openCreate?: boolean;
  slug: string;
  venueName: string;
  openHours: OpenHours[];
  timezone: string;
  currency: string;
  view: CalView;
  anchor: string;
  today: string;
  spaces: CalSpace[];
  bookings: CalBooking[];
  canManage: boolean;
  managerEmail: string | null;
  taxBps: number;
  depositPct: number;
  securityDepositCents: number;
}

const VIEWS: { value: CalView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

export function CalendarView(props: CalendarViewProps) {
  const { slug, openHours, timezone, currency, view, anchor, today, spaces, bookings, canManage, taxBps, depositPct, securityDepositCents } =
    props;

  const [weekLayout, setWeekLayout] = React.useState<"schedule" | "spaces">("schedule");
  const [newPrefill, setNewPrefill] = React.useState<NewBookingPrefill | null>(() => props.openCreate && canManage && spaces.length ? { date: anchor, spaceId: spaces[0].id } : null);
  const [selected, setSelected] = React.useState<CalBooking | null>(null);
  const [movePrefill, setMovePrefill] = React.useState<MoveTarget | null>(null);
  const [spaceFilter, setSpaceFilter] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<CalTone | "">("");
  // Selected day (month side panel / phone day strip), keyed so it resets
  // whenever the period being shown changes.
  const [sel, setSel] = React.useState<{ key: string; day: string | null }>({ key: anchor, day: null });
  const [mDay, setMDay] = React.useState({ key: `${view}:${anchor}`, day: anchor });
  const mobileDay = mDay.key === `${view}:${anchor}` ? mDay.day : anchor;

  const href = (v: CalView, date: string) => `/app/${slug}/calendar?view=${v}&date=${date}`;
  const stepDate = (dir: -1 | 1) =>
    view === "month"
      ? addMonthsStr(anchor, dir)
      : view === "week"
        ? addDaysStr(anchor, 7 * dir)
        : addDaysStr(anchor, dir);
  const prevHref = href(view, stepDate(-1));
  const nextHref = href(view, stepDate(1));
  const todayHref = href(view, today);
  const unit = view === "month" ? "month" : view === "week" ? "week" : "day";

  const title =
    view === "month" ? monthTitle(anchor) : view === "week" ? weekTitle(startOfWeekStr(anchor)) : dayTitle(anchor);

  const days = React.useMemo(() => visibleDays(view, anchor), [view, anchor]);
  const visibleSpaces = spaceFilter ? spaces.filter((s) => s.id === spaceFilter) : spaces;
  const filtersActive = spaceFilter !== "" || statusFilter !== "";

  const filtered = React.useMemo(
    () =>
      bookings.filter(
        (b) =>
          (!spaceFilter || b.spaceId === spaceFilter) &&
          (!statusFilter || toneOf(b.status) === statusFilter)
      ),
    [bookings, spaceFilter, statusFilter]
  );

  // Venue-local day bounds of the visible range.
  const dayBounds = React.useMemo(
    () =>
      days.map((d) => ({
        day: d,
        from: venueLocalToUtc(timezone, d, "00:00").getTime(),
        to: venueLocalToUtc(timezone, addDaysStr(d, 1), "00:00").getTime(),
      })),
    [days, timezone]
  );

  // booking → every venue-local day it overlaps (month grid).
  const byDay = React.useMemo(() => {
    const map = new Map<string, CalBooking[]>();
    for (const b of filtered) {
      for (const { day, from, to } of dayBounds) {
        if (b.start < to && b.end > from) {
          const list = map.get(day) ?? [];
          list.push(b);
          map.set(day, list);
        }
      }
    }
    return map;
  }, [filtered, dayBounds]);

  const rangeFrom = dayBounds[0]?.from ?? 0;
  const rangeTo = dayBounds[dayBounds.length - 1]?.to ?? 0;
  const inRange = (b: CalBooking) => b.blockedStart < rangeTo && b.blockedEnd > rangeFrom;
  const anyInRange = bookings.some(inRange);
  const anyFilteredInRange = filtered.some(inRange);

  function openBookingAt(prefill: NewBookingPrefill) {
    if (!canManage) return;
    setNewPrefill(prefill);
  }

  function openNew() {
    const date = view === "month" ? (panelDay ?? mobileDay) : view === "week" ? mobileDay : anchor;
    openBookingAt({
      date,
      spaceId: spaceFilter || spaces[0]?.id,
      startTime: "18:00",
      endTime: "22:00",
    });
  }

  function clearFilters() {
    setSpaceFilter("");
    setStatusFilter("");
  }

  const newBookingButton = (size: "default" | "sm" = "default") =>
    canManage ? (
      <Button size={size} onClick={openNew} disabled={spaces.length === 0}>
        <Plus className="h-4 w-4" aria-hidden />
        New booking
      </Button>
    ) : null;

  const emptyRange = !anyInRange ? (
    <EmptyState
      title="No bookings yet"
      description={
        canManage
          ? "Create your first booking to start filling your calendar."
          : `Nothing is booked this ${unit}.`
      }
      action={newBookingButton()}
    />
  ) : !anyFilteredInRange ? (
    <EmptyState
      icon={SearchX}
      title="No bookings match these filters"
      description={`Nothing this ${unit} for the selected space or status.`}
      action={
        <Button variant="outline" onClick={clearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : null;

  const navButtons = (
    <div className="inline-flex items-center gap-1.5">
      <Link
        href={prevHref}
        scroll={false}
        aria-label={`Previous ${unit}`}
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Link>
      <Link href={todayHref} scroll={false} className={buttonVariants({ variant: "outline" })}>
        Today
      </Link>
      <Link
        href={nextHref}
        scroll={false}
        aria-label={`Next ${unit}`}
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );

  const segmented = (full: boolean) => (
    <div
      role="group"
      aria-label="Calendar view"
      className={cn(
        "rounded-lg border border-border bg-secondary p-1",
        full ? "grid grid-cols-3 gap-1" : "inline-flex gap-0.5"
      )}
    >
      {VIEWS.map((v) => (
        <Link
          key={v.value}
          href={href(v.value, anchor)}
          scroll={false}
          aria-current={view === v.value ? "page" : undefined}
          className={cn(
            "inline-flex items-center justify-center rounded-md px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            full ? "h-10" : "h-8",
            view === v.value
              ? "bg-card text-foreground shadow-sm ring-1 ring-border"
              : "text-secondary-foreground hover:bg-card/60"
          )}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );

  const statusSelect = (className: string) => (
    <Select
      aria-label="Filter by status"
      className={className}
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value as CalTone | "")}
    >
      <option value="">All statuses</option>
      {STATUS_GROUPS.map((g) => (
        <option key={g.value} value={g.value}>
          {g.label}
        </option>
      ))}
    </Select>
  );
  const spaceSelect = (className: string) => (
    <Select
      aria-label="Filter by space"
      className={className}
      value={spaceFilter}
      onChange={(e) => setSpaceFilter(e.target.value)}
    >
      <option value="">All spaces</option>
      {spaces.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );

  // Month view: the day shown in the side panel (resets when the month changes).
  const panelDay = sel.key === anchor ? sel.day : null;
  const panelBookings = React.useMemo(
    () => (panelDay ? [...(byDay.get(panelDay) ?? [])].sort((a, b) => a.start - b.start) : []),
    [byDay, panelDay]
  );

  function selectMonthDay(day: string) {
    setSel({ key: anchor, day });
    setMDay({ key: `${view}:${anchor}`, day });
    if (canManage && spaces.length > 0 && (byDay.get(day) ?? []).length === 0) {
      openBookingAt({ date: day, spaceId: spaceFilter || spaces[0]?.id });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{view === "day" ? longDayTitle(anchor) : "Calendar"}</h1><p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Globe2 className="h-3.5 w-3.5 text-primary" aria-hidden />{timezone} · venue local time</p></div>
        <div className="hidden flex-wrap items-center gap-2 md:flex">{segmented(false)}{navButtons}{newBookingButton()}{spaces.length === 0 && canManage && <Link href={`/app/${slug}/spaces/new`} className={buttonVariants()}><Plus className="h-4 w-4" />Add space</Link>}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3 md:hidden">{segmented(false)}<div className="ml-auto"><LegendPopover spaces={spaces} /></div><div className="flex w-full items-center justify-between gap-3">{navButtons}<span className="text-sm font-medium" aria-live="polite">{view === "day" ? "Day view" : title}</span></div></div>
      <div className="hidden flex-wrap items-center gap-3 md:flex">{view !== "month" && <h2 className="mr-auto text-lg font-semibold" aria-live="polite">{title}</h2>}{spaceSelect("w-40")}{statusSelect("w-44")}{filtersActive && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>}<LegendPopover spaces={spaces} /></div>

      {spaces.length === 0 ? (
        <div className="flex min-h-[520px] items-center justify-center rounded-xl border border-border bg-card shadow-sm">
          <div className="px-6 py-20 text-center"><span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-accent text-primary"><CalendarPlus className="h-8 w-8" aria-hidden /></span><h2 className="text-lg font-semibold">Add a space to start scheduling</h2><p className="mt-2 text-sm text-muted-foreground">Your calendar needs at least one space before bookings can be created.</p>{canManage && <div className="mt-5 flex justify-center gap-2"><Link href={`/app/${slug}/spaces/new`} className={buttonVariants()}>Add space</Link><Link href={`/app/${slug}`} className={buttonVariants({ variant: "outline" })}>View setup</Link></div>}<p className="mx-auto mt-5 max-w-md rounded-lg border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">Configure capacity and operating hours when adding your space.</p></div>
        </div>
      ) : (
        <>
          {/* Phones */}
          <div className="md:hidden">
            {view === "month" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2"><ul aria-label="Filter spaces" className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">{[{ id: "", name: "All spaces" }, ...spaces].map((space) => <li key={space.id} className="shrink-0"><button type="button" aria-pressed={spaceFilter === space.id} onClick={() => setSpaceFilter(space.id)} className={cn("min-h-10 rounded-lg border px-3 text-xs font-medium", spaceFilter === space.id ? "border-primary bg-primary text-white" : "border-border bg-card")}>{space.name}</button></li>)}</ul></div>
                {statusSelect("w-full")}
                <MonthGrid slug={slug} timezone={timezone} anchor={anchor} today={today} days={days} byDay={byDay} selectedDay={mobileDay} onDaySelect={(day) => { setMDay({ key: `${view}:${anchor}`, day }); setSel({ key: anchor, day }); }} onBookingClick={setSelected} compact />
                <section aria-label="Selected day bookings" className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">{longDayTitle(mobileDay)}</h2><p className="mt-1 text-xs text-muted-foreground">{(byDay.get(mobileDay) ?? []).length} bookings · {(byDay.get(mobileDay) ?? []).filter((booking) => toneOf(booking.status) === "hold").length} holds</p></div><Link href={href("day", mobileDay)} className="text-xs font-medium text-primary">View details</Link></div>
                  {(byDay.get(mobileDay) ?? []).length === 0 ? <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Nothing booked on this day.{canManage && <Button variant="outline" size="sm" className="mt-3 block" onClick={() => openBookingAt({ date: mobileDay, spaceId: spaceFilter || spaces[0]?.id })}>Book this day</Button>}</div> : (byDay.get(mobileDay) ?? []).map((booking) => <button key={booking.id} type="button" onClick={() => setSelected(booking)} className="block w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm"><span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{booking.spaceName}</span><span className={cn("rounded-full px-2 py-0.5 text-[10px]", toneOf(booking.status) === "hold" ? "bg-warning-soft text-warning" : "bg-accent text-primary")}>{STATUS_LABELS[booking.status]}</span></span><span className="mt-1 block text-sm">{booking.clientName}</span><span className="mt-2 block text-xs text-muted-foreground">{timeRange(booking.start, booking.end, timezone)}{booking.blockedStart < booking.start ? ` · Setup ${formatInVenueTz(new Date(booking.blockedStart), timezone, "h:mm a")}` : ""}</span>{booking.holdExpiresAt && <span className="mt-1 block text-xs text-warning">Hold expires {formatInVenueTz(new Date(booking.holdExpiresAt), timezone, "MMM d, h:mm a")}</span>}</button>)}
                </section>
              </div>
            ) : (
              <MobileDay
                slug={slug}
                view={view}
                today={today}
                timezone={timezone}
                anchor={anchor}
                selectedDay={mobileDay}
                onSelectDay={(d) => setMDay({ key: `${view}:${anchor}`, day: d })}
                spaces={spaces}
                bookings={bookings}
                openHours={openHours}
                spaceFilter={spaceFilter}
                onSpaceFilter={setSpaceFilter}
                statusFilter={statusFilter}
                onStatusFilter={setStatusFilter}
                canManage={canManage}
                onBookingClick={setSelected}
                onBook={openBookingAt}
              />
            )}
          </div>

          {/* md+: month grid + selected day, or timeline */}
          <div className="hidden md:block">
            {view === "month" ? (
              <div className="flex items-stretch gap-4 lg:gap-6">
                <div className="min-w-0 flex-1">
                  <MonthGrid
                    slug={slug}
                    timezone={timezone}
                    anchor={anchor}
                    today={today}
                    days={days}
                    byDay={byDay}
                    selectedDay={panelDay}
                    onDaySelect={selectMonthDay}
                    onBookingClick={setSelected}
                    emptyState={!anyInRange ? emptyRange : undefined}
                    footer={<div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border px-3 py-3 text-[10px] text-muted-foreground"><span className="text-primary">● Confirmed</span><span className="text-warning">◷ Penciled hold</span><span>◌ Inquiry / quote</span><span>▧ Setup / teardown</span></div>}
                  />
                </div>
                {panelDay && (
                  <DayPanel
                    key={panelDay}
                    slug={slug}
                    day={panelDay}
                    timezone={timezone}
                    bookings={panelBookings}
                    allBookings={bookings}
                    spaces={visibleSpaces}
                    openHours={openHours}
                    canManage={canManage}
                    onClose={() => setSel({ key: anchor, day: null })}
                    onBookingClick={setSelected}
                    onBook={openBookingAt}
                  />
                )}
              </div>
            ) : (
              <>
                <p className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" aria-hidden />
                  All times in {timezone}
                </p>
                {view === "week" && <div className="mb-4 inline-flex rounded-lg border border-border bg-accent/30 p-1">{(["schedule", "spaces"] as const).map((layout) => <button type="button" key={layout} aria-pressed={weekLayout === layout} onClick={() => setWeekLayout(layout)} className={cn("rounded-md px-3 py-1.5 text-xs", weekLayout === layout && "bg-card shadow-sm")}>{layout === "schedule" ? "Time schedule" : "Spaces timeline"}</button>)}</div>}
                {view === "week" && weekLayout === "spaces" ? <SpaceWeek timezone={timezone} days={days} spaces={visibleSpaces} bookings={filtered} canManage={canManage} onBookingClick={setSelected} onBookingDrop={(booking, target) => { setSelected(booking); setMovePrefill(target); }} /> : <div className={cn("grid items-start gap-5", view === "day" && "xl:grid-cols-[minmax(0,1fr)_280px]")}>
                <Timeline
                  timezone={timezone}
                  today={today}
                  spaces={visibleSpaces}
                  bookings={filtered}
                  canManage={canManage}
                  days={days}
                  onSlotClick={(spaceId, date, startTime, endTime, endsNextDay) =>
                    openBookingAt({ spaceId, date, startTime, endTime, endsNextDay })
                  }
                  onBookingClick={setSelected}
                  onBookingDrop={(b, target) => {
                    setSelected(b);
                    setMovePrefill(target);
                  }}
                  footer={!anyFilteredInRange && filtersActive ? <div className="border-t border-border">{emptyRange}</div> : undefined}
                />
                {view === "day" && <PhoneBookingPanel key={`${anchor}:${spaceFilter}`} day={anchor} timezone={timezone} currency={currency} spaces={visibleSpaces} bookings={bookings} openHours={openHours} canManage={canManage} taxBps={taxBps} depositPct={depositPct} securityDepositCents={securityDepositCents} onBook={openBookingAt} onBookingClick={setSelected} />}
                </div>}
              </>
            )}


          </div>
        </>
      )}

      {canManage && spaces.length > 0 && <><div aria-hidden className="h-16 md:hidden" /><div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"><Button onClick={openNew} className="w-full"><Plus className="h-4 w-4" aria-hidden />New booking</Button></div></>}
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
        currency={currency}
        spaces={spaces}
        managerEmail={props.managerEmail}
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
