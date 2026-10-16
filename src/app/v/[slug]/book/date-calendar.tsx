"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatInVenueTz, venueLocalToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";
export function DateCalendar({ date, minimum, timezone, onChange }: { date: string; minimum?: string; timezone: string; onChange: (date: string) => void }) {
  const [month, setMonth] = React.useState(() => (date || minimum || formatInVenueTz(new Date(), timezone, "yyyy-MM-dd")).slice(0, 7));
  const initial = venueLocalToUtc("UTC", `${month}-01`, "12:00");
  const first = new Date(initial.getTime() - initial.getUTCDay() * 86400000);
  const daysInMonth = new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth() + 1, 0)).getUTCDate();
  const count = Math.ceil((daysInMonth + initial.getUTCDay()) / 7) * 7;
  const shiftMonth = (direction: number) => new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth() + direction, 1, 12));
  const iso = (value: Date) => formatInVenueTz(value, "UTC", "yyyy-MM-dd");
  return <section aria-label="Choose a date" className="mb-5 rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{formatInVenueTz(initial, "UTC", "MMMM yyyy")}</h3><div className="flex gap-1"><button type="button" aria-label="Previous month" disabled={Boolean(minimum && month <= minimum.slice(0, 7))} onClick={() => setMonth(iso(shiftMonth(-1)).slice(0, 7))} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label="Next month" onClick={() => setMonth(iso(shiftMonth(1)).slice(0, 7))} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted"><ChevronRight className="h-4 w-4" /></button></div></div><p className="mb-3 text-xs text-muted-foreground">Choose your event date · {timezone}</p><div className="grid grid-cols-7 gap-1">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day} className="py-2 text-center text-[10px] text-muted-foreground">{day}</span>)}{Array.from({ length: count }, (_, index) => { const value = iso(new Date(first.getTime() + index * 86400000)); return <button key={value} type="button" aria-label={formatInVenueTz(venueLocalToUtc(timezone, value, "12:00"), timezone, "EEEE MMMM d yyyy")} aria-pressed={value === date} disabled={Boolean(minimum && value < minimum)} onClick={() => onChange(value)} className={cn("min-h-11 rounded-lg text-xs focus-visible:outline-2 focus-visible:outline-ring", value === date ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent", value.slice(0, 7) !== month && "text-muted-foreground", minimum && value < minimum && "opacity-30")}>{Number(value.slice(8))}</button>; })}</div></section>;
}
