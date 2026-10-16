"use client";

import * as React from "react";
import { GripVertical, Move, TriangleAlert } from "lucide-react";
import { formatInVenueTz, venueDateStr, venueLocalToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";
import { addDaysStr, dayHeaderLabel, isTentative, targetRange, timeRange, toneOf, type CalBooking, type CalSpace, type MoveTarget } from "./cal-shared";
import { MONTH_CHIP } from "./month-grid";
import { hatchStyle } from "./cal-ui";

export function SpaceWeek({ timezone, days, spaces, bookings, canManage, onBookingClick, onBookingDrop }: { timezone: string; days: string[]; spaces: CalSpace[]; bookings: CalBooking[]; canManage: boolean; onBookingClick: (booking: CalBooking) => void; onBookingDrop: (booking: CalBooking, target: MoveTarget) => void }) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<MoveTarget | null>(null);
  const cancelled = React.useRef(false);
  React.useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (event.key === "Escape") { cancelled.current = true; setDragId(null); setPreview(null); } };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  const from = venueLocalToUtc(timezone, days[0], "06:00").getTime();
  const to = venueLocalToUtc(timezone, addDaysStr(days[days.length - 1], 1), "06:00").getTime();
  const position = (instant: number) => Math.max(0, Math.min(100, (instant - from) / (to - from) * 100));
  const dragging = bookings.find((item) => item.id === dragId);
  const destination = spaces.find((item) => item.id === preview?.spaceId);
  const range = preview ? targetRange(timezone, preview, destination) : null;
  const conflict = Boolean(dragging && preview && range && (bookings.some((item) => item.id !== dragId && item.spaceId === preview.spaceId && !isTentative(item.status) && item.blockedStart < range.blockedEnd! && item.blockedEnd > range.blockedStart!) || Math.max(destination?.seatedCapacity ?? 0, destination?.standingCapacity ?? 0) > 0 && dragging.guestCount > Math.max(destination?.seatedCapacity ?? 0, destination?.standingCapacity ?? 0)));
  function dragTarget(event: React.DragEvent<HTMLDivElement>, space: CalSpace): MoveTarget | null {
    if (!dragging || cancelled.current) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(0.99999, (event.clientX - rect.left) / rect.width));
    const index = Math.floor(fraction * days.length);
    const minutes = Math.round(((fraction * days.length - index) * 1440 + 360) / 15) * 15;
    const date = minutes >= 1440 ? addDaysStr(days[index], 1) : days[index];
    const clock = minutes % 1440;
    const time = `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
    const start = venueLocalToUtc(timezone, date, time);
    const end = new Date(start.getTime() + dragging.end - dragging.start);
    return { spaceId: space.id, date, startTime: time, endTime: formatInVenueTz(end, timezone, "HH:mm"), endsNextDay: venueDateStr(end, timezone) !== date };
  }
  return <div>
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm"><div className="min-w-[900px]">
      <div className="grid border-b border-border bg-background" style={{ gridTemplateColumns: `120px repeat(${days.length}, 1fr)` }}><div />{days.map((day) => <div key={day} className={cn("border-l border-border px-3 py-3 text-xs", preview?.date === day && "bg-accent/40 text-primary")}><p>{dayHeaderLabel(day)}</p></div>)}</div>
      {spaces.map((space) => <div key={space.id} className="grid border-b border-border" style={{ gridTemplateColumns: "120px 1fr" }}><div className="bg-background px-3 py-7"><p className="text-xs font-semibold">{space.name}</p><p className="mt-1 text-[10px] text-muted-foreground">Capacity {Math.max(space.seatedCapacity ?? 0, space.standingCapacity ?? 0) || "not set"}</p></div><div className="relative h-24 border-l border-border" onDragOver={(event) => { if (!canManage || !dragging || cancelled.current) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; setPreview(dragTarget(event, space)); }} onDrop={(event) => { if (!dragging || cancelled.current) return; event.preventDefault(); const target = dragTarget(event, space); if (target) onBookingDrop(dragging, target); setDragId(null); setPreview(null); }}>
        <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days.length * 3}, 1fr)` }}>{Array.from({ length: days.length * 3 }, (_, index) => <span key={index} className="border-r border-border/70" />)}</div>
        {bookings.filter((booking) => booking.spaceId === space.id && booking.blockedStart < to && booking.blockedEnd > from).map((booking, index) => <button key={booking.id} type="button" draggable={canManage && !isTentative(booking.status)} onDragStart={(event) => { cancelled.current = false; setDragId(booking.id); event.dataTransfer.setData("text/venuora-booking", booking.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDragId(null); setPreview(null); }} onClick={() => onBookingClick(booking)} className={cn("absolute flex min-w-16 items-start gap-1 overflow-hidden rounded-md border-l-[3px] px-2 py-2 text-left text-[10px]", MONTH_CHIP[toneOf(booking.status)], dragId === booking.id && "opacity-35")} style={{ left: `${position(booking.start)}%`, width: `${Math.max(5, position(booking.end) - position(booking.start))}%`, top: 14 + index % 2 * 38, maxHeight: 42 }}><GripVertical className="h-3 w-3 shrink-0" aria-hidden /><span><span className="block truncate font-semibold">{booking.clientName}</span><span className="block truncate text-[9px]">{timeRange(booking.start, booking.end, timezone)}</span></span></button>)}
        {preview?.spaceId === space.id && range && dragging && <div className={cn("pointer-events-none absolute top-7 z-20 flex min-w-24 items-start gap-1 rounded-md border px-2 py-2 text-[10px] shadow-lg", conflict ? "border-destructive text-destructive" : "border-primary bg-accent/70 text-primary")} style={{ left: `${position(range.start)}%`, width: `${Math.max(6, position(range.end) - position(range.start))}%`, ...(conflict ? hatchStyle("#dc2626") : {}) }}>{conflict ? <TriangleAlert className="h-3 w-3 shrink-0" /> : <GripVertical className="h-3 w-3 shrink-0" />}<span><strong>{conflict ? "Conflict" : dragging.clientName}</strong><span className="block text-[9px]">Move preview · {timeRange(range.start, range.end, timezone)}</span><span className="mt-1 block text-[9px]">Release to check availability</span></span></div>}
      </div></div>)}
      <footer className="flex items-center gap-2 bg-background px-4 py-3 text-[10px] text-muted-foreground"><Move className="h-3 w-3 text-primary" />{canManage ? "Drag to move booking" : "Read-only schedule"}<span className="ml-2 border-l border-border pl-3">Time zone: {timezone}</span></footer>
    </div></div>
    {dragging && <div role="status" className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs shadow-sm"><Move className="h-4 w-4 text-primary" />Move preview · release to check availability · Esc to cancel</div>}
  </div>;
}
