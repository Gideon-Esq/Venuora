"use client";

import * as React from "react";
import { ArrowUpRight, CircleAlert, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import { venueLocalToUtc } from "@/lib/time";
import { computeDeposit, priceBooking } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  addDaysStr, blocksSpace, freeWindows, longDayTitle, operatingWindow, timeRange, windowPrefill,
  type CalBooking, type CalSpace, type OpenHours,
} from "./cal-shared";
import type { NewBookingPrefill } from "./new-booking-dialog";

export function PhoneBookingPanel({ day, timezone, currency, spaces, bookings, openHours, canManage, taxBps, depositPct, securityDepositCents, onBook, onBookingClick }: {
  day: string; timezone: string; currency: string; spaces: CalSpace[]; bookings: CalBooking[];
  openHours: OpenHours[]; canManage: boolean; taxBps: number; depositPct: number; securityDepositCents: number;
  onBook: (prefill: NewBookingPrefill) => void; onBookingClick: (booking: CalBooking) => void;
}) {
  const [spaceId, setSpaceId] = React.useState(spaces[0]?.id ?? "");
  const [windowStart, setWindowStart] = React.useState<number | null>(null);
  const selectedSpace = spaces.find((space) => space.id === spaceId) ?? spaces[0];
  const win = operatingWindow(timezone, day, openHours);
  const from = win?.start ?? venueLocalToUtc(timezone, day, "00:00").getTime();
  const to = win?.end ?? venueLocalToUtc(timezone, addDaysStr(day, 1), "00:00").getTime();
  const busy = bookings.filter((booking) => booking.spaceId === selectedSpace?.id && blocksSpace(booking) && booking.blockedStart < to && booking.blockedEnd > from);
  const windows = win && selectedSpace ? freeWindows(win, busy.map((booking) => ({ start: booking.blockedStart, end: booking.blockedEnd })), selectedSpace) : [];
  const selectedWindow = windows.find((window) => window.start === windowStart) ?? windows[0];
  const hours = selectedSpace?.ratePlan?.minBookingHours ?? 2;
  const previewRange = selectedWindow ? { start: selectedWindow.start, end: Math.min(selectedWindow.end, selectedWindow.start + hours * 3_600_000) } : null;
  const quote = selectedSpace?.ratePlan && previewRange ? priceBooking({ spaceName: selectedSpace.name, ratePlan: selectedSpace.ratePlan, slotType: "HOURLY", start: new Date(previewRange.start), end: new Date(previewRange.end), timezone, addOns: [], taxBps }) : null;
  const id = React.useId();

  return (
    <aside aria-labelledby={`${id}-title`} className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary"><Phone className="h-3 w-3" aria-hidden />Phone booking context</p><h2 id={`${id}-title`} className="mt-2 text-lg font-semibold">{selectedSpace?.name ?? "Choose a space"}</h2><p className="mt-1 text-xs text-muted-foreground">Find a time while you’re on the call.</p></div>
      {spaces.length > 1 && <Select aria-label="Space for phone booking" value={selectedSpace?.id ?? ""} onChange={(event) => { setSpaceId(event.target.value); setWindowStart(null); }}>{spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</Select>}
      <dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-foreground">Capacity</dt><dd className="mt-1 font-medium">{selectedSpace?.seatedCapacity ? `${selectedSpace.seatedCapacity} seated` : selectedSpace?.standingCapacity ? `${selectedSpace.standingCapacity} standing` : "Not set"}</dd></div><div><dt className="text-muted-foreground">Selected date</dt><dd className="mt-1 font-medium">{longDayTitle(day)}</dd></div></dl>
      <section aria-label="Available windows"><h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Available windows</h3>{windows.length === 0 ? <p className="text-sm text-muted-foreground">{win ? "No available windows in this space." : "The venue is closed on this day."}</p> : <ul className="space-y-2">{windows.map((window) => <li key={window.start}><button type="button" aria-pressed={window.start === selectedWindow?.start} onClick={() => setWindowStart(window.start)} className={cn("flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs", window.start === selectedWindow?.start ? "border-primary/30 bg-accent/50 text-primary" : "border-border bg-background hover:bg-muted")}>{timeRange(window.start, window.end, timezone)}<ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden /></button></li>)}</ul>}</section>
      {busy.length > 0 && <section aria-label="Blocking bookings" className="rounded-lg border border-destructive/15 bg-danger-soft p-3"><h3 className="flex items-center gap-1.5 text-xs font-medium text-destructive"><CircleAlert className="h-3.5 w-3.5" aria-hidden />Already reserved</h3><ul className="mt-2 space-y-2">{busy.slice(0, 3).map((booking) => <li key={booking.id}><button type="button" className="w-full text-left text-xs text-muted-foreground hover:text-primary" onClick={() => onBookingClick(booking)}>{booking.clientName} · {timeRange(booking.start, booking.end, timezone)}</button></li>)}</ul></section>}
      {quote && previewRange && <div className="rounded-lg bg-muted p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hourly price preview</p><p className="mt-2 font-semibold">{formatMoney(quote.totalCents, currency)} estimated total</p><p className="mt-1 text-xs text-primary">{formatMoney(computeDeposit(quote.totalCents, depositPct), currency)} deposit</p><p className="mt-2 text-xs text-muted-foreground">{timeRange(previewRange.start, previewRange.end, timezone)} · before add-ons{quote.taxCents > 0 ? ", includes tax" : ""}</p>{securityDepositCents > 0 && <p className="mt-1 text-xs text-muted-foreground">Plus {formatMoney(securityDepositCents, currency)} refundable security deposit</p>}</div>}
      {canManage && selectedSpace && previewRange && <Button className="w-full" onClick={() => onBook(windowPrefill(timezone, previewRange, selectedSpace.id))}><Plus className="h-4 w-4" aria-hidden />Book available window</Button>}
      {!canManage && <p className="text-xs text-muted-foreground">An owner or manager can create a booking.</p>}
    </aside>
  );
}
