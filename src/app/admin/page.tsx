// Super-admin panel: venue list, usage stats, MRR overview, impersonation
// (audit-logged via requireVenue's super-admin path — just click through).

import Link from "next/link";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/tenancy";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PLAN_MRR_CENTS: Record<string, number> = {
  TRIAL: 0,
  SOLO: 4_900,
  GROWTH: 9_900,
  PRO: 19_900,
};

export default async function AdminPage() {
  await requireSuperAdmin();

  const venues = await db.venue.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { spaces: true, bookings: true, clients: true, members: true } },
    },
  });

  const mrrCents = venues.reduce((s, v) => s + (PLAN_MRR_CENTS[v.planTier] ?? 0), 0);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const bookings30d = await db.booking.count({
    where: { createdAt: { gte: thirtyDaysAgo } },
  });
  const volume30d = await db.payment.aggregate({
    where: {
      status: "SUCCEEDED",
      type: { in: ["BOOKING_DEPOSIT", "BALANCE"] },
      createdAt: { gte: thirtyDaysAgo },
    },
    _sum: { amountCents: true },
  });
  const recentImpersonations = await db.auditLog.findMany({
    where: { action: "IMPERSONATE" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { actor: true, venue: true },
  });

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Venuora admin</h1>
          <p className="text-sm text-zinc-500">Platform overview</p>
        </div>
        <Link href="/app" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Back to app
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Venues", value: String(venues.length) },
          { label: "MRR", value: formatMoney(mrrCents) },
          { label: "Bookings (30d)", value: String(bookings30d) },
          { label: "Payment volume (30d)", value: formatMoney(volume30d._sum.amountCents ?? 0) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <p className="text-sm text-zinc-500">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Venues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500">
                  <th className="py-2 pr-4 font-medium">Venue</th>
                  <th className="py-2 pr-4 font-medium">Plan</th>
                  <th className="py-2 pr-4 font-medium">Spaces</th>
                  <th className="py-2 pr-4 font-medium">Bookings</th>
                  <th className="py-2 pr-4 font-medium">Clients</th>
                  <th className="py-2 pr-4 font-medium">Stripe</th>
                  <th className="py-2 pr-4 font-medium">Public</th>
                  <th className="py-2 font-medium">Open</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((v) => (
                  <tr key={v.id} className="border-b border-zinc-100">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-zinc-900">{v.name}</p>
                      <p className="text-xs text-zinc-500">/{v.slug}</p>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge className="bg-indigo-100 text-indigo-800">{v.planTier}</Badge>
                    </td>
                    <td className="py-2.5 pr-4">{v._count.spaces}</td>
                    <td className="py-2.5 pr-4">{v._count.bookings}</td>
                    <td className="py-2.5 pr-4">{v._count.clients}</td>
                    <td className="py-2.5 pr-4">{v.stripeChargesEnabled ? "✓ enabled" : "—"}</td>
                    <td className="py-2.5 pr-4">{v.published ? "✓ live" : "draft"}</td>
                    <td className="py-2.5">
                      <Link
                        href={`/app/${v.slug}`}
                        className="font-medium text-indigo-600 hover:underline"
                        title="Opens the venue dashboard as super-admin (audit-logged)"
                      >
                        Impersonate →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent impersonations (audit log)</CardTitle>
        </CardHeader>
        <CardContent>
          {recentImpersonations.length === 0 ? (
            <p className="text-sm text-zinc-500">None yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentImpersonations.map((log) => (
                <li key={log.id} className="flex justify-between border-b border-zinc-100 pb-2">
                  <span>
                    <span className="font-medium">{log.actor?.email ?? "?"}</span> →{" "}
                    {log.venue?.name ?? "?"}
                  </span>
                  <span className="text-zinc-500">{log.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
