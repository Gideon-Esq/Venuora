import { describe, expect, it } from "vitest";
import { venueLocalToUtc } from "../src/lib/time";
import { clockMinutes, clockSpan, packLanes, verticalSlot } from "../src/app/app/[venueSlug]/calendar/timeline-layout";

const timezone = "America/New_York";
const instant = (day: string, time: string) => venueLocalToUtc(timezone, day, time).getTime();

describe("calendar timeline layout", () => {
  it("keeps overlapping bookings in separate lanes and gives later groups full width", () => {
    const packed = packLanes([
      { id: "first", start: 10, end: 40 },
      { id: "second", start: 20, end: 30 },
      { id: "third", start: 30, end: 50 },
      { id: "later", start: 60, end: 70 },
    ]);
    expect(packed.map(({ id, lane, lanes }) => ({ id, lane, lanes }))).toEqual([
      { id: "first", lane: 0, lanes: 2 },
      { id: "second", lane: 1, lanes: 2 },
      { id: "third", lane: 1, lanes: 2 },
      { id: "later", lane: 0, lanes: 1 },
    ]);
  });

  it("treats touching edges as separate half-open intervals", () => {
    expect(packLanes([{ id: "a", start: 10, end: 20 }, { id: "b", start: 20, end: 30 }]).every((item) => item.lanes === 1)).toBe(true);
  });

  it("uses blocked intervals so a setup buffer also consumes a lane", () => {
    const intervals = [{ id: "event", start: 100, end: 200 }, { id: "next-setup", start: 190, end: 300 }];
    expect(packLanes(intervals).map((item) => item.lanes)).toEqual([2, 2]);
  });

  it("places overnight times on the following part of the same axis", () => {
    expect(clockMinutes(instant("2026-10-12", "01:30"), "2026-10-11", timezone)).toBe(25 * 60 + 30);
  });

  it("keeps the clock axis consistent across daylight saving changes", () => {
    expect(clockMinutes(instant("2026-03-09", "01:00"), "2026-03-08", timezone)).toBe(25 * 60);
    expect(clockMinutes(instant("2026-11-02", "01:00"), "2026-11-01", timezone)).toBe(25 * 60);
  });

  it("prefills an after-midnight click on the next venue-local date", () => {
    expect(verticalSlot("2026-10-11", 0.95)).toEqual({ date: "2026-10-12", time: "01:00", minutes: 60 });
  });

  it("keeps a booking visible when the clock rolls backwards during its event", () => {
    const start = Date.parse("2026-11-01T01:40:00-04:00");
    const end = Date.parse("2026-11-01T01:10:00-05:00");
    expect(clockSpan(start, end, "2026-10-31", timezone)).toEqual({ from: 1540, to: 1570 });
  });

  it("clamps clicks to the visible time range", () => {
    expect(verticalSlot("2026-10-11", -1).time).toBe("06:00");
    expect(verticalSlot("2026-10-11", 2).time).toBe("01:30");
  });
});
