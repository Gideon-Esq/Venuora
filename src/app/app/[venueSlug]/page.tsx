import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarCheck2,
  Check,
  Inbox,
  Link2,
  Users,
} from "lucide-react";
import { sendBalanceLinkAction, toggleChecklistAction } from "@/actions/booking";
import { setTourStatusAction } from "@/actions/tours";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { requireVenue, roleAtLeast } from "@/lib/tenancy";
import { addDays, formatInVenueTz, venueDateStr, venueLocalToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "This week — Venuora" };

function monthBoundsUtc(now: Date, tz: string): { from: Date; to: Date } {
  const today = venueDateStr(now, tz); // YYYY-MM-DD
  const [y, m] = today.split("-").map(Number);
  const from = venueLocalToUtc(tz, `${today.slice(0, 7)}-01`, "00:00");
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const to = venueLocalToUtc(tz, `${nextY}-${String(nextM).padStart(2, "0")}-01`, "00:00");
  return { from, to };
}

export default async function ThisWeekPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue, role } = await requireVenue(venueSlug);
  const canManage = roleAtLeast(role, "MANAGER");
  const tz = venue.timezone;
  const now = new Date();

  const todayStart = venueLocalToUtc(tz, venueDateStr(now, tz), "00:00");
  const weekEnd = addDays(todayStart, 7);
  const month = monthBoundsUtc(now, tz);

  const [bookings, pendingTours, inquiries, confirmedThisMonth, revenueAgg, inquiryCount] =
    await Promise.all([
      db.booking.findMany({
        where: {
          venueId: venue.id,
          status: { in: ["PENCILED", "CONFIRMED"] },
          start: { gte: todayStart, lt: weekEnd },
        },
        include: {
          client: { select: { name: true, phone: true } },
          space: { select: { name: true, color: true } },
          payments: { select: { type: true, status: true, amountCents: true } },
        },
        orderBy: { start: "asc" },
      }),
      db.tourRequest.findMany({
        where: { venueId: venue.id, status: "PENDING" },
        orderBy: { requestedAt: "asc" },
        take: 8,
      }),
      db.booking.findMany({
        where: { venueId: venue.id, status: "INQUIRY" },
        include: {
          client: { select: { name: true } },
          space: { select: { name: true, color: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      db.booking.count({
        where: {
          venueId: venue.id,
          status: { in: ["CONFIRMED", "COMPLETED"] },
          start: { gte: month.from, lt: month.to },
        },
      }),
      db.payment.aggregate({
        where: {
          venueId: venue.id,
          status: "SUCCEEDED",
          type: { in: ["BOOKING_DEPOSIT", "BALANCE"] },
          createdAt: { gte: month.from, lt: month.to },
        },
        _sum: { amountCents: true },
      }),
      db.booking.count({ where: { venueId: venue.id, status: "INQUIRY" } }),
    ]);

  const revenueThisMonth = revenueAgg._sum.amountCents ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">This week</h1>
        <p className="mt-1 text-sm text-zinc-500">
          The next 7 days at {venue.name} — times shown in {tz.replace(/_/g, " ")}.
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={<CalendarCheck2 className="h-5 w-5 text-indigo-600" />}
          label="Confirmed this month"
          value={String(confirmedThisMonth)}
        />
        <StatTile
          icon={<BadgeDollarSign className="h-5 w-5 text-emerald-600" />}
          label="Collected this month"
          value={formatMoney(revenueThisMonth, venue.currency)}
        />
        <StatTile
          icon={<Inbox className="h-5 w-5 text-sky-600" />}
          label="Pending inquiries"
          value={String(inquiryCount)}
        />
      </div>

      {/* Upcoming bookings */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Upcoming events
        </h2>
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-zinc-500">
              Nothing penciled or confirmed in the next 7 days.{" "}
              <Link
                href={`/app/${venue.slug}/calendar`}
                className="font-medium text-indigo-600 hover:underline"
              >
                Open the calendar
              </Link>{" "}
              to add a booking.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {bookings.map((b) => {
              const paid = b.payments
                .filter(
                  (p) =>
                    p.status === "SUCCEEDED" &&
                    (p.type === "BOOKING_DEPOSIT" || p.type === "BALANCE")
                )
                .reduce((s, p) => s + p.amountCents, 0);
              const outstanding = b.totalCents - paid;
              const sameDay = venueDateStr(b.start, tz) === venueDateStr(b.end, tz);
              return (
                <Card key={b.id}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/app/${venue.slug}/bookings/${b.id}`}
                          className="truncate font-medium text-zinc-900 hover:text-indigo-700"
                        >
                          {b.client.name}
                        </Link>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-zinc-500">
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: b.space.color }}
                          />
                          {b.space.name} · {EVENT_TYPE_LABELS[b.eventType]}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>

                    <p className="text-sm text-zinc-700">
                      {formatInVenueTz(b.start, tz, "EEE, MMM d · h:mm a")} –{" "}
                      {formatInVenueTz(b.end, tz, sameDay ? "h:mm a" : "EEE h:mm a")}
                      <span className="ml-2 inline-flex items-center gap-1 text-zinc-500">
                        <Users className="h-3.5 w-3.5" />
                        {b.guestCount}
                      </span>
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <ChecklistToggle
                        slug={venue.slug}
                        bookingId={b.id}
                        field="setupDone"
                        done={b.setupDone}
                        label="Setup"
                      />
                      <ChecklistToggle
                        slug={venue.slug}
                        bookingId={b.id}
                        field="eventDone"
                        done={b.eventDone}
                        label="Teardown"
                      />
                    </div>

                    {outstanding > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2">
                        <p className="text-sm font-medium text-amber-800">
                          {formatMoney(outstanding, venue.currency)} outstanding
                        </p>
                        {canManage && (
                          <form
                            action={async () => {
                              "use server";
                              await sendBalanceLinkAction(venueSlug, b.id);
                              revalidatePath(`/app/${venueSlug}`);
                            }}
                          >
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-amber-800 shadow-sm ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              Send payment link
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending tour requests */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Tour requests
          </h2>
          <Card>
            {pendingTours.length === 0 ? (
              <CardContent className="p-6 text-center text-sm text-zinc-500">
                No pending tour requests.
              </CardContent>
            ) : (
              <CardContent className="divide-y divide-zinc-100 p-0">
                {pendingTours.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">{t.name}</p>
                      <p className="text-xs text-zinc-500">
                        {formatInVenueTz(t.requestedAt, tz, "EEE, MMM d · h:mm a")}
                        {t.phone ? ` · ${t.phone}` : ""}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        <form
                          action={async () => {
                            "use server";
                            await setTourStatusAction(venueSlug, t.id, "CONFIRMED");
                            revalidatePath(`/app/${venueSlug}`);
                          }}
                        >
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Confirm
                          </button>
                        </form>
                        <form
                          action={async () => {
                            "use server";
                            await setTourStatusAction(venueSlug, t.id, "DECLINED");
                            revalidatePath(`/app/${venueSlug}`);
                          }}
                        >
                          <button
                            type="submit"
                            className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
                          >
                            Decline
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </section>

        {/* New inquiries */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            New inquiries
          </h2>
          <Card>
            {inquiries.length === 0 ? (
              <CardContent className="p-6 text-center text-sm text-zinc-500">
                No open inquiries. Nice and tidy.
              </CardContent>
            ) : (
              <CardContent className="divide-y divide-zinc-100 p-0">
                {inquiries.map((b) => (
                  <Link
                    key={b.id}
                    href={`/app/${venue.slug}/bookings/${b.id}`}
                    className="group flex items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900 group-hover:text-indigo-700">
                        {b.client.name}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: b.space.color }}
                        />
                        {b.space.name} · {EVENT_TYPE_LABELS[b.eventType]} ·{" "}
                        {formatInVenueTz(b.start, tz, "MMM d")}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      <Badge className="bg-sky-100 text-sky-800">New</Badge>
                      <ArrowRight className="h-4 w-4 text-zinc-300 group-hover:text-indigo-500" />
                    </span>
                  </Link>
                ))}
              </CardContent>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-5 pb-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-50 ring-1 ring-inset ring-zinc-100">
          {icon}
        </span>
        <CardTitle className="text-sm font-medium text-zinc-500">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <p className="text-2xl font-semibold tabular-nums text-zinc-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function ChecklistToggle({
  slug,
  bookingId,
  field,
  done,
  label,
}: {
  slug: string;
  bookingId: string;
  field: "setupDone" | "eventDone";
  done: boolean;
  label: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await toggleChecklistAction(slug, bookingId, field, !done);
      }}
    >
      <button
        type="submit"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
          done
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
            : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
        )}
      >
        <span
          className={cn(
            "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border",
            done ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300 bg-white"
          )}
        >
          {done && <Check className="h-2.5 w-2.5" />}
        </span>
        {label}
      </button>
    </form>
  );
}
