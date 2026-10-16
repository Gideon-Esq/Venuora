import { toRatePlanInput } from "@/lib/booking-helpers";
import { blockingWhere } from "@/lib/booking";
import { db } from "@/lib/db";
import { requireVenue, roleAtLeast } from "@/lib/tenancy";
import { venueDateStr, venueLocalToUtc } from "@/lib/time";
import { addDaysStr, visibleDays, type CalBooking, type CalView, type OpenHours } from "./cal-shared";
import { CalendarView } from "./calendar-view";

export const metadata = { title: "Calendar — Venuora" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Defensive parse of Venue.operatingHours (JSON column). */
function parseOpenHours(raw: unknown): OpenHours[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((h): OpenHours[] => {
    if (!h || typeof h !== "object") return [];
    const o = h as Record<string, unknown>;
    if (typeof o.dow !== "number" || typeof o.open !== "string" || typeof o.close !== "string") return [];
    if (!TIME_RE.test(o.open) || !TIME_RE.test(o.close)) return [];
    return [{ dow: o.dow, open: o.open, close: o.close, closed: o.closed === true }];
  });
}

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ view?: string; date?: string; new?: string }>;
}) {
  const [{ venueSlug }, sp] = await Promise.all([params, searchParams]);
  const { venue, role } = await requireVenue(venueSlug);
  const tz = venue.timezone;

  const todayStr = venueDateStr(new Date(), tz);
  const view: CalView =
    sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const anchor = sp.date && DATE_RE.test(sp.date) ? sp.date : todayStr;

  // Visible venue-local day range for the current view — the same helper
  // the client grid uses (Monday-first weeks) — plus a 1-day margin each
  // side so bars clipped at edges/midnight still load. Day view loads its
  // whole week so the phone day-strip can show per-day counts.
  const days = visibleDays(view === "day" ? "week" : view, anchor);
  const firstDay = days[0];
  const dayCount = days.length;
  const from = venueLocalToUtc(tz, addDaysStr(firstDay, -1), "00:00");
  const to = venueLocalToUtc(tz, addDaysStr(firstDay, dayCount + 1), "06:00");

  const [spaces, bookings, manager] = await Promise.all([
    db.space.findMany({
      where: { venueId: venue.id, active: true },
      select: { id: true, name: true, color: true, seatedCapacity: true, standingCapacity: true, setupBufferMins: true, teardownBufferMins: true, ratePlan: { include: { peakPeriods: true } } },
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
      include: { payments: { where: { status: "SUCCEEDED", type: { in: ["BOOKING_DEPOSIT", "BALANCE"] } }, select: { amountCents: true } }, client: { select: { name: true, phone: true, email: true } }, space: { select: { name: true } } },
      orderBy: { start: "asc" },
    }),
    db.venueMember.findFirst({ where: { venueId: venue.id, role: { in: ["OWNER", "MANAGER"] } }, select: { user: { select: { email: true } } }, orderBy: { role: "asc" } }),
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
    clientEmail: b.client.email,
    start: b.start.getTime(),
    end: b.end.getTime(),
    blockedStart: b.blockedStart.getTime(),
    blockedEnd: b.blockedEnd.getTime(),
    guestCount: b.guestCount,
    totalCents: b.totalCents,
    depositCents: b.depositCents,
    notes: b.notes,
    paidCents: b.payments.reduce((sum, payment) => sum + payment.amountCents, 0),
    holdExpiresAt: b.holdExpiresAt ? b.holdExpiresAt.getTime() : null,
  }));

  return (
    <CalendarView
      openCreate={sp.new === "1" && roleAtLeast(role, "MANAGER")}
      slug={venue.slug}
      venueName={venue.name}
      openHours={parseOpenHours(venue.operatingHours)}
      timezone={tz}
      currency={venue.currency}
      view={view}
      anchor={anchor}
      today={todayStr}
      spaces={spaces.map((space) => ({ ...space, ratePlan: space.ratePlan ? toRatePlanInput(space.ratePlan) : null }))}
      taxBps={venue.taxBps}
      depositPct={venue.depositPct}
      securityDepositCents={venue.securityDepositCents}
      bookings={calBookings}
      managerEmail={venue.email || manager?.user.email || null}
      canManage={roleAtLeast(role, "MANAGER")}
    />
  );
}
