// Super-admin panel: venue list, usage stats, MRR overview, impersonation
// (audit-logged via requireVenue's super-admin path — just click through).

import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  CircleDashed,
  CreditCard,
  Globe,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/tenancy";
import { formatMoney } from "@/lib/money";
import { formatInVenueTz } from "@/lib/time";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin" };

const PLAN_MRR_CENTS: Record<string, number> = {
  TRIAL: 0,
  SOLO: 4_900,
  GROWTH: 9_900,
  PRO: 19_900,
};

const PLAN_LABELS: Record<string, string> = {
  TRIAL: "Trial",
  SOLO: "Solo",
  GROWTH: "Growth",
  PRO: "Pro",
};

const IMPERSONATE_TITLE = "Opens the venue dashboard as super-admin (audit-logged)";

function initials(nameOrEmail: string | null | undefined): string {
  if (!nameOrEmail) return "?";
  const base = nameOrEmail.includes("@") ? nameOrEmail.split("@")[0] : nameOrEmail;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : base.slice(0, 2);
  return letters.toUpperCase();
}

function relativeTime(date: Date, now: Date): string {
  const mins = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatInVenueTz(date, "UTC", "MMM d, yyyy");
}

export default async function AdminPage() {
  const admin = await requireSuperAdmin();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [venues, bookings30d, volume30d, auditRows] = await Promise.all([
    db.venue.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { spaces: true, bookings: true, clients: true, members: true } },
      },
    }),
    db.booking.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.payment.aggregate({
      where: {
        status: "SUCCEEDED",
        type: { in: ["BOOKING_DEPOSIT", "BALANCE"] },
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { amountCents: true },
    }),
    db.auditLog.findMany({
      where: { action: "IMPERSONATE" },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { actor: true, venue: true },
    }),
  ]);

  const mrrCents = venues.reduce((s, v) => s + (PLAN_MRR_CENTS[v.planTier] ?? 0), 0);
  const publishedCount = venues.filter((v) => v.published).length;

  // Each impersonated page view can log more than once; collapse consecutive
  // entries for the same actor + venue within a minute.
  const impersonations: typeof auditRows = [];
  for (const row of auditRows) {
    const prev = impersonations[impersonations.length - 1];
    if (
      prev &&
      prev.actorUserId === row.actorUserId &&
      prev.venueId === row.venueId &&
      prev.createdAt.getTime() - row.createdAt.getTime() < 60_000
    ) {
      continue;
    }
    impersonations.push(row);
    if (impersonations.length === 8) break;
  }

  const adminName = admin.name ?? admin.email;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold tracking-tight">Venuora Admin</span>
            <Link
              href="/app"
              className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to app
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm leading-tight md:block">
              <p className="font-medium text-foreground">{adminName}</p>
              <p className="text-muted-foreground">Super admin</p>
            </div>
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background"
              title={`${adminName} · Super admin`}
            >
              <span aria-hidden>{initials(admin.name ?? admin.email)}</span>
              <span className="sr-only">{adminName}, super admin</span>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] space-y-8 px-4 py-6 sm:px-8 lg:py-10">
        <Link
          href="/app"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-primary sm:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to app
        </Link>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Operations</p>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">
            Operations overview
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Monitor venue activity, revenue, and operator access.
          </p>
        </div>

        <section aria-label="Platform stats" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon={TrendingUp}
            label="MRR"
            value={formatMoney(mrrCents)}
            hint="Monthly recurring revenue · estimated from plan prices"
          />
          <StatCard icon={CalendarCheck2} label="Bookings 30d" value={String(bookings30d)} hint="Created across all venues" />
          <StatCard
            icon={CreditCard}
            label="Payment volume 30d"
            value={formatMoney(volume30d._sum.amountCents ?? 0)}
            hint="Deposits and balances via Stripe"
          />
          <StatCard
            icon={Building2}
            label="Active venues"
            value={String(publishedCount)}
            hint={`Published · ${venues.length} total`}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          {/* Venues */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle>Venues</CardTitle>
              <CardDescription>Plan, setup and publishing status for every venue.</CardDescription>
            </CardHeader>

            {venues.length === 0 ? (
              <p className="border-t border-border px-6 py-10 text-center text-sm text-muted-foreground">
                No venues yet.
              </p>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-6 py-3 font-medium">Venue</th>
                        <th scope="col" className="px-3 py-3 font-medium">Plan</th>
                        <th scope="col" className="px-3 py-3 text-right font-medium">Spaces</th>
                        <th scope="col" className="px-3 py-3 text-right font-medium">Bookings</th>
                        <th scope="col" className="px-3 py-3 text-right font-medium">Clients</th>
                        <th scope="col" className="px-3 py-3 font-medium">Stripe</th>
                        <th scope="col" className="px-3 py-3 font-medium">Public status</th>
                        <th scope="col" className="px-6 py-3 text-right font-medium">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {venues.map((v) => (
                        <tr key={v.id}>
                          <td className="px-6 py-3.5">
                            <p className="font-medium">{v.name}</p>
                            <p className="text-xs text-muted-foreground">/{v.slug}</p>
                          </td>
                          <td className="px-3 py-3.5">{PLAN_LABELS[v.planTier] ?? v.planTier}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums">{v._count.spaces}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums">{v._count.bookings}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums">{v._count.clients}</td>
                          <td className="px-3 py-3.5">
                            <StripeStatus connected={v.stripeChargesEnabled} />
                          </td>
                          <td className="px-3 py-3.5">
                            <PublicStatus published={v.published} />
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <ImpersonateLink slug={v.slug} name={v.name} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <ul className="divide-y divide-border border-t border-border md:hidden">
                  {venues.map((v) => (
                    <li key={v.id} className="space-y-3 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{v.name}</p>
                          <p className="truncate text-xs text-muted-foreground">/{v.slug}</p>
                        </div>
                        <Badge variant="accent">{PLAN_LABELS[v.planTier] ?? v.planTier}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {v._count.spaces} spaces · {v._count.bookings} bookings · {v._count.clients} clients
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <StripeStatus connected={v.stripeChargesEnabled} />
                        <PublicStatus published={v.published} />
                      </div>
                      <ImpersonateLink slug={v.slug} name={v.name} className="w-full" />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* Impersonation activity */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Recent impersonation activity</CardTitle>
              </CardHeader>
              <div className="px-6 pb-6">
                {impersonations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No impersonations yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {impersonations.map((log) => {
                      const actor = log.actor?.name ?? log.actor?.email ?? "Unknown user";
                      return (
                        <li key={log.id} className="flex gap-3">
                          <span
                            aria-hidden
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground"
                          >
                            {initials(log.actor?.name ?? log.actor?.email)}
                          </span>
                          <div className="min-w-0 text-sm">
                            <p className="break-words">
                              <span className="font-medium">{actor}</span>
                              <span className="text-muted-foreground"> · {log.venue?.name ?? "Deleted venue"}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <time
                                dateTime={log.createdAt.toISOString()}
                                title={`${formatInVenueTz(log.createdAt, "UTC", "yyyy-MM-dd HH:mm")} UTC`}
                              >
                                {relativeTime(log.createdAt, now)}
                              </time>
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
            <div className="flex gap-3 rounded-xl border border-border bg-muted px-4 py-4 text-sm text-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <p>Impersonation is audited. Every page you open as a venue is logged.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-2 break-words text-2xl font-semibold leading-tight tabular-nums tracking-tight sm:text-[28px]">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">{hint}</p>
    </Card>
  );
}

function StripeStatus({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1.5 text-success">
      <CheckCircle2 className="h-4 w-4" aria-hidden />
      Connected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <CircleDashed className="h-4 w-4" aria-hidden />
      Not connected
    </span>
  );
}

function PublicStatus({ published }: { published: boolean }) {
  return published ? (
    <span className="inline-flex items-center gap-1.5 text-success">
      <Globe className="h-4 w-4" aria-hidden />
      Published
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <CircleDashed className="h-4 w-4" aria-hidden />
      Draft
    </span>
  );
}

function ImpersonateLink({ slug, name, className }: { slug: string; name: string; className?: string }) {
  return (
    <Link
      href={`/app/${slug}`}
      title={IMPERSONATE_TITLE}
      aria-label={`Impersonate ${name} (audit-logged)`}
      className={cn(
        buttonVariants({ size: "sm" }),
        "bg-foreground text-background hover:bg-foreground/85 max-md:h-10",
        className
      )}
    >
      Impersonate
    </Link>
  );
}
