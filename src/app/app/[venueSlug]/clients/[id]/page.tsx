import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { paidTowardsBooking } from "@/lib/payments";
import { requireVenue } from "@/lib/tenancy";
import { formatInVenueTz } from "@/lib/time";
import { ClientEditForm } from "./client-edit-form";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue } = await requireVenue(venueSlug, "MANAGER");

  const client = await db.client.findUnique({
    where: { id },
    include: {
      bookings: {
        include: {
          space: { select: { name: true } },
          payments: { select: { type: true, status: true, amountCents: true } },
        },
        orderBy: { start: "desc" },
      },
    },
  });
  if (!client || client.venueId !== venue.id) notFound();

  const lifetimeCents = client.bookings.reduce(
    (s, b) => s + paidTowardsBooking(b.payments),
    0
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div>
        <Link
          href={`/app/${venueSlug}/clients`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> All clients
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">{client.name}</h1>
        <p className="text-sm text-zinc-500">
          {client.bookings.length} booking{client.bookings.length === 1 ? "" : "s"} · lifetime
          spend {formatMoney(lifetimeCents, venue.currency)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contact details</CardTitle>
            <CardDescription>Keep this up to date so quotes and reminders reach them.</CardDescription>
          </CardHeader>
          <CardContent>
            <ClientEditForm
              slug={venueSlug}
              clientId={client.id}
              initial={{
                name: client.name,
                phone: client.phone ?? "",
                email: client.email ?? "",
                organization: client.organization ?? "",
                notes: client.notes ?? "",
              }}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Booking history</CardTitle>
          </CardHeader>
          <CardContent>
            {client.bookings.length === 0 ? (
              <p className="text-sm text-zinc-500">No bookings yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {client.bookings.map((b) => {
                  const paid = paidTowardsBooking(b.payments);
                  return (
                    <li key={b.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={`/app/${venueSlug}/bookings/${b.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-1 hover:bg-zinc-50"
                      >
                        <div>
                          <div className="font-medium text-zinc-900">
                            {formatInVenueTz(b.start, venue.timezone, "EEE, MMM d yyyy 'at' h:mm a")}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {b.space.name} · {EVENT_TYPE_LABELS[b.eventType]}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right text-sm">
                            <div className="font-medium text-zinc-900">
                              {formatMoney(b.totalCents, venue.currency)}
                            </div>
                            <div className="text-xs text-emerald-700">
                              {formatMoney(paid, venue.currency)} paid
                            </div>
                          </div>
                          <StatusBadge status={b.status} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
