import { blockingWhere } from "@/lib/booking";
import { db } from "@/lib/db";
import { requireVenue, roleAtLeast } from "@/lib/tenancy";
import { venueDateStr, venueLocalToUtc } from "@/lib/time";
import {
  addDaysStr,
  dowOfStr,
  startOfMonthStr,
  type CalBooking,
  type CalView,
} from "./cal-shared";
import { CalendarView } from "./calendar-view";

export const metadata = { title: "Calendar — Venuora" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const [{ venueSlug }, sp] = await Promise.all([params, searchParams]);
  const { venue, role } = await requireVenue(venueSlug);
  const tz = venue.timezone;

  const todayStr = venueDateStr(new Date(), tz);
  const view: CalView =
    sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const anchor = sp.date && DATE_RE.test(sp.date) ? sp.date : todayStr;

  // Visible venue-local day range for the current view (+1-day margin each
  // side so bars clipped at edges/midnight still load).
  let firstDay: string;
  let dayCount: number;
  if (view === "month") {
    const first = startOfMonthStr(anchor);
    firstDay = addDaysStr(first, -dowOfStr(first));
    dayCount = 42;
  } else if (view === "week") {
    firstDay = addDaysStr(anchor, -dowOfStr(anchor));
    dayCount = 7;
  } else {
    firstDay = anchor;
    dayCount = 1;
  }
  const from = venueLocalToUtc(tz, addDaysStr(firstDay, -1), "00:00");
  const to = venueLocalToUtc(tz, addDaysStr(firstDay, dayCount + 1), "06:00");

  const [spaces, bookings] = await Promise.all([
    db.space.findMany({
      where: { venueId: venue.id, active: true },
      select: { id: true, name: true, color: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.booking.findMany({
      where: {
        venueId: venue.id,
        blockedStart: { lt: to },
        blockedEnd: { gt: from },
        OR: [
          // Blocking bookings…
          ...(blockingWhere().OR ?? []),
          // …plus inquiries/quotes: they don't block, but owners want to
          // see them (rendered faintly with dashed borders).
          { status: { in: ["INQUIRY", "QUOTE_SENT"] } },
        ],
      },
      include: { client: { select: { name: true, phone: true } }, space: { select: { name: true } } },
      orderBy: { start: "asc" },
    }),
  ]);

  const calBookings: CalBooking[] = bookings.map((b) => ({
    id: b.id,
    spaceId: b.spaceId,
    spaceName: b.space.name,
    status: b.status,
    eventType: b.eventType,
    slotType: b.slotType,
    clientName: b.client.name,
    clientPhone: b.client.phone,
    start: b.start.getTime(),
    end: b.end.getTime(),
    blockedStart: b.blockedStart.getTime(),
    blockedEnd: b.blockedEnd.getTime(),
    guestCount: b.guestCount,
    totalCents: b.totalCents,
    depositCents: b.depositCents,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Calendar</h1>
        <p className="mt-1 text-sm text-zinc-500">
          All times in {tz.replace(/_/g, " ")}. Click an empty slot to book while the
          caller is on the line.
        </p>
      </div>
      <CalendarView
        slug={venue.slug}
        timezone={tz}
        currency={venue.currency}
        view={view}
        anchor={anchor}
        today={todayStr}
        spaces={spaces}
        bookings={calBookings}
        canManage={roleAtLeast(role, "MANAGER")}
      />
    </div>
  );
}
