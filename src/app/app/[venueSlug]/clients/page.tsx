import Link from "next/link";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { paidTowardsBooking } from "@/lib/payments";
import { requireVenue } from "@/lib/tenancy";

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { venueSlug } = await params;
  const sp = await searchParams;
  const { venue } = await requireVenue(venueSlug);
  const q = (sp.q ?? "").trim();

  const clients = await db.client.findMany({
    where: {
      venueId: venue.id,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
              { organization: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      bookings: {
        select: {
          id: true,
          payments: { select: { type: true, status: true, amountCents: true } },
        },
      },
    },
    orderBy: { name: "asc" },
    take: 300,
  });

  const rows = clients.map((c) => ({
    ...c,
    bookingCount: c.bookings.length,
    lifetimeCents: c.bookings.reduce((s, b) => s + paidTowardsBooking(b.payments), 0),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Clients</h1>
        <p className="text-sm text-zinc-500">
          Everyone who has booked or inquired — with their lifetime spend at your venue.
        </p>
      </div>

      <form className="flex max-w-md gap-2" action={`/app/${venueSlug}/clients`}>
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search name, phone, email or organization…"
          aria-label="Search clients"
        />
        <Button type="submit" variant="secondary">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </form>

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-zinc-500">
          {q ? "No clients match your search." : "No clients yet — they're created automatically with each booking."}
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 text-right font-medium">Bookings</th>
                  <th className="px-4 py-3 text-right font-medium">Lifetime spend</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/${venueSlug}/clients/${c.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-700">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-700">{c.organization ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-zinc-700">{c.bookingCount}</td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">
                      {formatMoney(c.lifetimeCents, venue.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((c) => (
              <Link key={c.id} href={`/app/${venueSlug}/clients/${c.id}`} className="block">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-zinc-900">{c.name}</div>
                      <div className="text-xs text-zinc-500">
                        {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact info"}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium text-zinc-900">
                        {formatMoney(c.lifetimeCents, venue.currency)}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {c.bookingCount} booking{c.bookingCount === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
