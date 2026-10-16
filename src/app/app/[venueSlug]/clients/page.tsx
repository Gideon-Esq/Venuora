import Link from "next/link";
import { ChevronRight, Mail, Phone, Search, Users, X } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { paidTowardsBooking } from "@/lib/payments";
import { requireVenue, roleAtLeast } from "@/lib/tenancy";
import { cn } from "@/lib/utils";

const LIMIT = 50;

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { venueSlug } = await params;
  const sp = await searchParams;
  const { venue, role } = await requireVenue(venueSlug);
  const q = (sp.q ?? "").trim();
  const page = Math.min(100000, Math.max(1, Math.floor(Number(sp.page) || 1)));
  // The client detail page requires MANAGER — Staff see names as plain text.
  const canOpen = roleAtLeast(role, "MANAGER");
  const base = `/app/${venueSlug}/clients`;

  const where: Prisma.ClientWhereInput = {
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
  };

  const [clients, total] = await Promise.all([
    db.client.findMany({
      where,
      include: {
        bookings: {
          where: { venueId: venue.id },
          select: {
            id: true,
            payments: { select: { type: true, status: true, amountCents: true } },
          },
        },
      },
      orderBy: { name: "asc" },
      take: LIMIT,
      skip: (page - 1) * LIMIT,
    }),
    db.client.count({ where }),
  ]);

  const rows = clients.map((c) => ({
    ...c,
    bookingCount: c.bookings.length,
    lifetimeCents: c.bookings.reduce((s, b) => s + paidTowardsBooking(b.payments), 0),
  }));

  const countLabel = q
    ? `${total} ${total === 1 ? "match" : "matches"}`
    : `${total} ${total === 1 ? "client" : "clients"}`;
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const pageHref = (value: number) => `${base}?${new URLSearchParams({ ...(q ? { q } : {}), page: String(value) })}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description="People connected to your venue bookings." />

      <Card className="border-0 bg-transparent p-0 shadow-none md:border md:bg-card md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <form action={base} role="search" className="relative w-full sm:max-w-md">
            <label htmlFor="client-search" className="sr-only">
              Search clients
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="client-search"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search name, phone, email, or organisation"
              className={cn("pl-9", q && "pr-10")}
            />
            {q && (
              <Link
                href={base}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </form>
          <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {countLabel}
          </p>
        </div>



        {rows.length === 0 ? (
          q ? (
            <EmptyState
              icon={Search}
              title={`No clients match “${q}”`}
              description="Try a different name, phone number, email or organisation."
              action={
                <Link href={base} className={buttonVariants({ variant: "outline" })}>
                  Clear search
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Clients appear after your first inquiry or booking."
            />
          )
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-5 hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-5 py-3">Name</th>
                    <th scope="col" className="px-4 py-3">Phone</th>
                    <th scope="col" className="px-4 py-3">Email</th>
                    <th scope="col" className="px-4 py-3">Organisation</th>
                    <th scope="col" className="px-4 py-3 text-right">Bookings</th>
                    <th scope="col" className="px-4 py-3 text-right">Lifetime spend</th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-border transition-colors hover:bg-muted/40"
                    >
                      <td className="px-5 py-4 font-medium text-foreground">
                        {canOpen ? (
                          <Link
                            href={`${base}/${c.id}`}
                            className="rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            {c.name}
                          </Link>
                        ) : (
                          c.name
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{c.phone ?? "—"}</td>
                      <td className="max-w-[16rem] truncate px-4 py-4 text-muted-foreground">
                        {c.email ?? "—"}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{c.organization || "—"}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-foreground">{c.bookingCount}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums text-foreground">
                        {formatMoney(c.lifetimeCents, venue.currency)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              aria-label={`Call ${c.name}`}
                              title={`Call ${c.name}`}
                              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                            >
                              <Phone className="h-4 w-4" aria-hidden />
                            </a>
                          )}
                          {c.email && (
                            <a
                              href={`mailto:${c.email}`}
                              aria-label={`Email ${c.name}`}
                              title={`Email ${c.name}`}
                              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                            >
                              <Mail className="h-4 w-4" aria-hidden />
                            </a>
                          )}
                          {canOpen && (
                            <Link
                              href={`${base}/${c.id}`}
                              aria-label={`Open ${c.name}`}
                              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                            >
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
              <ul className="mt-5 space-y-3 md:hidden">{rows.map((client) => <li key={client.id} className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div>{canOpen ? <Link href={`${base}/${client.id}`} className="font-semibold">{client.name}</Link> : <p className="font-semibold">{client.name}</p>}<p className="mt-1 text-xs text-muted-foreground">{client.organization || "Individual client"}</p></div>{canOpen && <Link aria-label={`Open ${client.name}`} href={`${base}/${client.id}`} className="flex h-11 w-11 items-center justify-center"><ChevronRight className="h-4 w-4" /></Link>}</div><div className="mt-3 space-y-2">{client.phone && <a href={`tel:${client.phone}`} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-xs text-primary"><Phone className="h-4 w-4" />{client.phone}</a>}{client.email && <a href={`mailto:${client.email}`} className="flex min-h-11 items-center gap-2 break-all rounded-lg border border-border px-3 text-xs text-primary"><Mail className="h-4 w-4 shrink-0" />{client.email}</a>}</div><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs"><div><dt className="text-muted-foreground">Bookings</dt><dd className="mt-1 font-medium">{client.bookingCount}</dd></div><div><dt className="text-muted-foreground">Lifetime spend</dt><dd className="mt-1 font-medium">{formatMoney(client.lifetimeCents, venue.currency)}</dd></div></dl></li>)}</ul>
          </>
        )}
      </Card>
      {pages > 1 && <nav aria-label="Client pages" className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {page} of {pages} · {total} clients</p><div className="flex gap-2">{page > 1 && <Link href={pageHref(page - 1)} className={buttonVariants({ variant: "outline" })}>Previous</Link>}{page < pages && <Link href={pageHref(page + 1)} className={buttonVariants({ variant: "outline" })}>Next</Link>}</div></nav>}
    </div>
  );
}
