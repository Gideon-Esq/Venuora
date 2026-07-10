import Link from "next/link";
import { Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { paidTowardsBooking } from "@/lib/payments";
import { requireVenue } from "@/lib/tenancy";
import { formatInVenueTz } from "@/lib/time";

const TABS = [
  { key: "all", label: "All" },
  { key: "inquiries", label: "Inquiries" },
  { key: "quotes", label: "Quotes" },
  { key: "penciled", label: "Penciled" },
  { key: "confirmed", label: "Confirmed" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function statusWhere(tab: TabKey, now: Date): Prisma.BookingWhereInput {
  switch (tab) {
    case "inquiries":
      return { status: "INQUIRY" };
    case "quotes":
      return { status: "QUOTE_SENT" };
    case "penciled":
      return { status: { in: ["PENCILED", "HOLD"] } };
    case "confirmed":
      return { status: "CONFIRMED", end: { gte: now } };
    case "past":
      return {
        OR: [
          { status: { in: ["COMPLETED", "NO_SHOW"] } },
          { status: "CONFIRMED", end: { lt: now } },
        ],
      };
    case "cancelled":
      return { status: { in: ["CANCELLED", "EXPIRED"] } };
    default:
      return {};
  }
}

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { venueSlug } = await params;
  const sp = await searchParams;
  const { venue } = await requireVenue(venueSlug);

  const tab: TabKey = TABS.some((t) => t.key === sp.status)
    ? (sp.status as TabKey)
    : "all";
  const q = (sp.q ?? "").trim();
  const now = new Date();

  const bookings = await db.booking.findMany({
    where: {
      venueId: venue.id,
      ...statusWhere(tab, now),
      ...(q
        ? {
            client: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
              ],
            },
          }
        : {}),
    },
    include: {
      client: true,
      space: true,
      payments: { select: { type: true, status: true, amountCents: true } },
    },
    orderBy: { start: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Bookings</h1>
          <p className="text-sm text-zinc-500">
            Every inquiry, quote and confirmed event in one place.
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const href =
            `/app/${venueSlug}/bookings?status=${t.key}` +
            (q ? `&q=${encodeURIComponent(q)}` : "");
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={href}
              className={
                active
                  ? "rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <form className="flex max-w-md gap-2" action={`/app/${venueSlug}/bookings`}>
        <input type="hidden" name="status" value={tab} />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by client name or phone…"
          aria-label="Search bookings"
        />
        <Button type="submit" variant="secondary">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </form>

      {bookings.length === 0 ? (
        <Card className="p-10 text-center text-sm text-zinc-500">
          {q
            ? "No bookings match your search."
            : "No bookings here yet. New inquiries and bookings will show up automatically."}
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Space</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Paid</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const paid = paidTowardsBooking(b.payments);
                  return (
                    <tr key={b.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/app/${venueSlug}/bookings/${b.id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {formatInVenueTz(b.start, venue.timezone, "EEE, MMM d yyyy")}
                        </Link>
                        <div className="text-xs text-zinc-500">
                          {formatInVenueTz(b.start, venue.timezone, "h:mm a")} –{" "}
                          {formatInVenueTz(b.end, venue.timezone, "h:mm a")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{b.client.name}</div>
                        {b.client.phone && (
                          <div className="text-xs text-zinc-500">{b.client.phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{b.space.name}</td>
                      <td className="px-4 py-3 text-zinc-700">
                        {EVENT_TYPE_LABELS[b.eventType]}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900">
                        {formatMoney(b.totalCents, venue.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700">
                        {formatMoney(paid, venue.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700">
                        {formatMoney(Math.max(0, b.totalCents - paid), venue.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {bookings.map((b) => {
              const paid = paidTowardsBooking(b.payments);
              return (
                <Link key={b.id} href={`/app/${venueSlug}/bookings/${b.id}`} className="block">
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-zinc-900">{b.client.name}</div>
                        <div className="text-xs text-zinc-500">
                          {formatInVenueTz(b.start, venue.timezone, "EEE, MMM d yyyy 'at' h:mm a")}
                        </div>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="mt-2 text-sm text-zinc-600">
                      {b.space.name} · {EVENT_TYPE_LABELS[b.eventType]}
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-zinc-500">
                        Paid {formatMoney(paid, venue.currency)} of{" "}
                        {formatMoney(b.totalCents, venue.currency)}
                      </span>
                      <span className="font-medium text-zinc-900">
                        {formatMoney(Math.max(0, b.totalCents - paid), venue.currency)} due
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
