import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Mail, Phone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { paidTowardsBooking } from "@/lib/payments";
import { requireVenue } from "@/lib/tenancy";
import { formatInVenueTz } from "@/lib/time";
import { ClientEditButton } from "./client-edit-form";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue } = await requireVenue(venueSlug, "MANAGER");

  const client = await db.client.findUnique({
    where: { id, venueId: venue.id },
    include: {
      bookings: {
        where: { venueId: venue.id },
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
  const base = `/app/${venueSlug}`;
  const dateFmt = "MMM d, yyyy";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link
              href={`${base}/clients`}
              className="rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              Clients
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="h-4 w-4" />
          </li>
          <li aria-current="page" className="min-w-0 truncate text-foreground">
            {client.name}
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="break-words text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[32px]">
            {client.name}
          </h1>
          {client.organization && (
            <p className="mt-1 text-[15px] text-muted-foreground">{client.organization}</p>
          )}
          {(client.phone || client.email) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="inline-flex items-center gap-2 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  {client.phone}
                </a>
              )}
              {client.email && (
                <a
                  href={`mailto:${client.email}`}
                  className="inline-flex min-w-0 items-center gap-2 break-all rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  {client.email}
                </a>
              )}
            </div>
          )}
        </div>
        <ClientEditButton
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
      </div>

      <div className="grid grid-cols-2 gap-2 md:hidden">{client.phone && <a href={`tel:${client.phone}`} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm text-primary"><Phone className="h-4 w-4" />Call</a>}{client.email && <a href={`mailto:${client.email}`} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm text-primary"><Mail className="h-4 w-4" />Email</a>}</div>
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 sm:p-6">
          <p className="text-sm text-muted-foreground">Bookings</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {client.bookings.length}
          </p>
        </Card>
        <Card className="p-5 sm:p-6">
          <p className="text-sm text-muted-foreground">Lifetime spend</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {formatMoney(lifetimeCents, venue.currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Paid deposits and balances, before refunds</p>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact details</CardTitle>
              <CardDescription>
                Client contact information for bookings and communication.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Detail label="Name" value={client.name} />
                <Detail label="Phone" value={client.phone} />
                <Detail label="Email" value={client.email} />
                <Detail label="Organisation" value={client.organization} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Internal notes</CardTitle>
              <CardDescription>Visible only to your team.</CardDescription>
            </CardHeader>
            <CardContent>
              {client.notes ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                  {client.notes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Booking history</CardTitle>
            <CardDescription>Recent and past bookings for this client.</CardDescription>
          </CardHeader>
          <CardContent>
            {client.bookings.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No bookings yet.
              </p>
            ) : (
              <>
                <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted">
                      <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="px-4 py-3">Booking</th>
                        <th scope="col" className="px-4 py-3">Date</th>
                        <th scope="col" className="px-4 py-3">Status</th>
                        <th scope="col" className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.bookings.map((b) => (
                        <tr
                          key={b.id}
                          className="border-t border-border transition-colors hover:bg-muted/40"
                        >
                          <td className="px-4 py-3.5">
                            <Link
                              href={`${base}/bookings/${b.id}`}
                              className="rounded-sm font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                            >
                              {EVENT_TYPE_LABELS[b.eventType]}
                            </Link>
                            <div className="text-xs text-muted-foreground">{b.space.name}</div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">
                            {formatInVenueTz(b.start, venue.timezone, dateFmt)}
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium tabular-nums text-foreground">
                            {formatMoney(b.totalCents, venue.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="space-y-3 md:hidden">
                  {client.bookings.map((b) => (
                    <li key={b.id}>
                      <Link
                        href={`${base}/bookings/${b.id}`}
                        className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">
                              {b.clientId === client.id ? client.name : EVENT_TYPE_LABELS[b.eventType]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatInVenueTz(b.start, venue.timezone, dateFmt)} · {b.space.name}
                            </p>
                          </div>
                          <StatusBadge status={b.status} />
                        </div>
                        <p className="mt-3 border-t border-border pt-3 text-right text-sm font-medium tabular-nums text-foreground">
                          {formatMoney(b.totalCents, venue.currency)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}
