import { calendarDaysUntil, formatInVenueTz, venueLocalToUtc } from "@/lib/time";
import { addDaysStr, HOUR_END, HOUR_START, minutesToTimeStr } from "./cal-shared";

/** Clock position on the vertical 06:00–02:00 axis, including overnight dates. */
export function clockMinutes(instant: number, day: string, timezone: string): number {
  const date = new Date(instant);
  const midnight = venueLocalToUtc(timezone, day, "00:00");
  const [hour, minute] = formatInVenueTz(date, timezone, "HH:mm").split(":").map(Number);
  return calendarDaysUntil(midnight, date, timezone) * 1440 + hour * 60 + minute;
}

/** A repeated DST hour must never turn a positive-duration booking into an invisible bar. */
export function clockSpan(start: number, end: number, day: string, timezone: string) {
  const from = clockMinutes(start, day, timezone);
  const to = clockMinutes(end, day, timezone);
  return { from, to: to <= from && end > start ? from + (end - start) / 60_000 : to };
}

export function verticalSlot(day: string, fraction: number, snap = 30) {
  const raw = HOUR_START * 60 + Math.max(0, Math.min(1, fraction)) * (HOUR_END - HOUR_START) * 60;
  const minutes = Math.min(HOUR_END * 60 - snap, Math.max(HOUR_START * 60, Math.round(raw / snap) * snap));
  return {
    date: minutes >= 1440 ? addDaysStr(day, 1) : day,
    time: minutesToTimeStr(minutes),
    minutes: minutes % 1440,
  };
}

export interface LaneInterval { id: string; start: number; end: number }
export interface LanePlacement extends LaneInterval { lane: number; lanes: number }

/** Pack intersecting blocked intervals into separate columns; touching edges can share. */
export function packLanes(intervals: LaneInterval[]): LanePlacement[] {
  const sorted = intervals.filter((item) => item.end > item.start).sort((a, b) => a.start - b.start || b.end - a.end);
  const result: LanePlacement[] = [];
  let group: LanePlacement[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  function flush() {
    for (const item of group) result.push({ ...item, lanes: laneEnds.length });
    group = [];
    laneEnds = [];
  }
  for (const item of sorted) {
    if (item.start >= groupEnd) flush();
    const free = laneEnds.findIndex((end) => end <= item.start);
    const lane = free < 0 ? laneEnds.length : free;
    laneEnds[lane] = item.end;
    group.push({ ...item, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, item.end);
  }
  flush();
  return result;
}
