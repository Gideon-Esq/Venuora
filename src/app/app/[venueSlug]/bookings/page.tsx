import Link from "next/link";
import { CalendarDays, CalendarPlus, ChevronRight, Lock, Plus, Search, SearchX, X } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { paidTowardsBooking } from "@/lib/payments";
import { requireVenue, roleAtLeast } from "@/lib/tenancy";
import { formatInVenueTz, venueDateStr } from "@/lib/time";
import { cn } from "@/lib/utils";

import { ReadOnlyNotice } from "./read-only-notice";

const LIST_CAP = 50;

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

function listHref(venueSlug: string, tab: TabKey, q?: string, page = 1) {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("status", tab);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/app/${venueSlug}/bookings${qs ? `?${qs}` : ""}`;
}

/** "5:00–10:00 PM", "11:00 AM–2:00 PM", or with a date when it spans midnight. */
function timeRange(start: Date, end: Date, tz: string) {
  if (venueDateStr(start, tz) !== venueDateStr(end, tz)) {
    return `${formatInVenueTz(start, tz, "h:mm a")} – ${formatInVenueTz(end, tz, "MMM d, h:mm a")}`;
  }
  const sameMeridiem = formatInVenueTz(start, tz, "a") === formatInVenueTz(end, tz, "a");
  return sameMeridiem
    ? `${formatInVenueTz(start, tz, "h:mm")}–${formatInVenueTz(end, tz, "h:mm a")}`
    : `${formatInVenueTz(start, tz, "h:mm a")}–${formatInVenueTz(end, tz, "h:mm a")}`;
}

function hasExpiry(status: BookingStatus) {
  return status === "PENCILED" || status === "HOLD";
}

/** Mobile money summary: one plain-language line per booking. */
function moneySummary(
  status: BookingStatus,
  totalCents: number,
  paid: number,
  currency: string
): { label: string; amount?: string; muted?: boolean } {
  const outstanding = Math.max(0, totalCents - paid);
  if (status === "INQUIRY") return { label: "Awaiting quote", muted: true };
  if (status === "CANCELLED" || status === "EXPIRED") {
    return paid > 0
      ? { label: "Paid", amount: formatMoney(paid, currency), muted: true }
      : { label: "Nothing paid", muted: true };
  }
  if (status === "QUOTE_SENT" && paid === 0) {
    return { label: "Total", amount: formatMoney(totalCents, currency) };
  }
  if (outstanding > 0) return { label: "Outstanding", amount: formatMoney(outstanding, currency) };
  if (totalCents === 0) return { label: "No charge", muted: true };
  return { label: "Paid in full", muted: true };
}

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { venueSlug } = await params;
  const sp = await searchParams;
  const { venue, role } = await requireVenue(venueSlug);
  const canOpen = roleAtLeast(role, "MANAGER");
  const isStaff = !canOpen;
  const tz = venue.timezone;

  const tab: TabKey = TABS.some((t) => t.key === sp.status) ? (sp.status as TabKey) : "all";
  const q = (sp.q ?? "").trim();
  const now = new Date();
  const page = Math.min(100000, Math.max(1, Math.floor(Number(sp.page) || 1)));

  const searchWhere: Prisma.BookingWhereInput = q ? { OR: [{ id: { contains: q, mode: "insensitive" } }, { client: { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] } }] } : {};

  const [bookings, counts] = await Promise.all([
    db.booking.findMany({
      where: { venueId: venue.id, ...statusWhere(tab, now), ...searchWhere },
      include: {
        client: { select: { name: true, phone: true, email: true } },
        space: { select: { name: true } },
        payments: { select: { type: true, status: true, amountCents: true } },
      },
      orderBy: { start: "desc" },
      take: LIST_CAP,
      skip: (page - 1) * LIST_CAP,
    }),
    Promise.all(
      TABS.map((t) =>
        db.booking.count({
          where: { AND: [{ venueId: venue.id }, statusWhere(t.key, now), searchWhere] },
        })
      )
    ),
  ]);

  const countFor = (key: TabKey) => counts[TABS.findIndex((t) => t.key === key)] ?? 0;
  const matching = countFor(tab);
  const pages = Math.max(1, Math.ceil(matching / LIST_CAP));
  const noBookingsAtAll = !q && countFor("all") === 0;
  const activeTab = TABS.find((t) => t.key === tab)!;

  const rows = bookings.map((b) => {
    const paid = paidTowardsBooking(b.payments);
    return {
      ...b,
      paid,
      outstanding: Math.max(0, b.totalCents - paid),
      href: `/app/${venueSlug}/bookings/${b.id}`,
      expires:
        hasExpiry(b.status) && b.holdExpiresAt
          ? formatInVenueTz(
              b.holdExpiresAt,
              tz,
              b.status === "HOLD" ? "MMM d, h:mm a" : "MMM d"
            )
          : null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description={
          <span className="hidden sm:inline">Track every inquiry, hold, and confirmed event in {venue.name}.</span>
        }
        className="flex-nowrap items-center sm:items-start"
        actions={
          canOpen ? (
            <Link
              href={`/app/${venueSlug}/calendar?new=1`}
              className={buttonVariants()}
              title="Create a booking"
            >
              <Plus className="h-4 w-4 sm:hidden" aria-hidden />
              <CalendarPlus className="hidden h-4 w-4 sm:block" aria-hidden />
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New booking</span>
            </Link>
          ) : null
        }
      />

      {isStaff && (
        <Callout tone="info" icon={Lock}>
          Staff access: you can review booking summaries, but details and changes are restricted.
        </Callout>
      )}

      <div className="space-y-4">
        {/* Search */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <form
          role="search"
          action={`/app/${venueSlug}/bookings`}
          className="flex max-w-xl flex-1 gap-2"
        >
          {tab !== "all" && <input type="hidden" name="status" value={tab} />}
          <div className="relative min-w-0 flex-1">
            <label htmlFor="bookings-search" className="sr-only">
              Search bookings by client name, phone or email
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="bookings-search"
              name="q"
              defaultValue={q}
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Search name, email, or booking ID"
              className={cn("pl-9", q && "pr-10")}
            />
            {q && (
              <Link
                href={listHref(venueSlug, tab)}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
          <Button type="submit" variant="outline" className="hidden sm:inline-flex">
            Search
          </Button>
        </form>
          <p className="shrink-0 text-sm text-muted-foreground tabular-nums" role="status">
            {matching} booking{matching === 1 ? "" : "s"}
            {q ? <> matching “{q}”</> : null}
          </p>
        </div>

        {/* Status tabs */}
        <nav aria-label="Filter bookings by status" className="-mx-4 sm:mx-0">
          <ul className="flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:px-0">
            {TABS.map((t) => {
              const active = t.key === tab;
              const n = countFor(t.key);
              return (
                <li key={t.key} className="shrink-0">
                  <Link
                    href={listHref(venueSlug, t.key, q)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      active
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                        active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {n}
                      <span className="sr-only"> bookings</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {tab !== "all" && <div className="flex"><Link href={listHref(venueSlug, "all", q)} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-accent px-3 text-xs font-medium text-primary">{activeTab.label} · {matching}<X className="h-3 w-3" aria-label="Clear status filter" /></Link></div>}
      {rows.length === 0 ? (
        <Card className={noBookingsAtAll ? "mx-auto my-24 max-w-xl py-8" : "flex min-h-[420px] items-center justify-center"}>
          {noBookingsAtAll ? (
            <EmptyState
              icon={CalendarDays}
              title="No bookings yet"
              description={
                canOpen
                  ? "Create your first booking from the calendar."
                  : "New inquiries and bookings will show up here automatically."
              }
              action={
                canOpen ? (
                  <Link href={`/app/${venueSlug}/calendar`} className={buttonVariants()}>
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    Open calendar
                  </Link>
                ) : null
              }
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title={q ? "No bookings match that search" : "No bookings match"}
              description={
                q
                  ? "Try a different name, email, or booking ID."
                  : `There are no bookings in “${activeTab.label}” right now.`
              }
              action={
                <Link
                  href={q ? listHref(venueSlug, tab) : listHref(venueSlug, "all")}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {q ? "Clear search" : "Show all bookings"}
                </Link>
              }
            />
          )}
        </Card>
      ) : (
        <>
          {tab === "inquiries" && <Card className="hidden overflow-hidden md:block"><table className="w-full text-left text-sm"><thead className="bg-muted text-xs uppercase text-muted-foreground"><tr>{["Client", "Requested date/time", "Requested space", "Contact", "Created", "Status", "Action"].map((label) => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((booking) => <tr key={booking.id}><td className="px-5 py-5 font-medium">{booking.client.name}<p className="mt-1 text-xs font-normal text-muted-foreground">Inquiry booking</p></td><td className="px-5 py-5">{formatInVenueTz(booking.start, tz, "MMM d")}<p className="mt-1 text-xs text-muted-foreground">{timeRange(booking.start, booking.end, tz)}</p></td><td className="px-5 py-5">{booking.space.name}</td><td className="px-5 py-5 text-xs"><p>{booking.client.email || "No email"}</p><p className="mt-1 text-muted-foreground">{booking.client.phone || "No phone"}</p></td><td className="px-5 py-5 text-xs">{formatInVenueTz(booking.createdAt, tz, "MMM d, yyyy")}</td><td className="px-5 py-5"><StatusBadge status={booking.status} /></td><td className="px-5 py-5">{canOpen ? <Link href={booking.href} className="text-xs font-medium text-primary">Open inquiry</Link> : <span className="text-xs text-muted-foreground">Summary only</span>}</td></tr>)}</tbody></table></Card>}
          {/* Desktop table */}
          <Card className={cn("hidden overflow-hidden md:block", tab === "inquiries" && "md:hidden")}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  {activeTab.label} bookings{q ? ` matching “${q}”` : ""}
                </caption>
                <thead className="bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">When</th>
                    <th scope="col" className="px-4 py-3 font-medium">Client</th>
                    <th scope="col" className="px-4 py-3 font-medium">Space</th>
                    <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Event</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Paid</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Outstanding</th>
                    {isStaff && (
                      <th scope="col" className="px-4 py-3 font-medium">Access</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((b) => (
                    <tr
                      key={b.id}
                      className={cn("relative align-top", canOpen && "transition-colors hover:bg-muted/60")}
                    >
                      <td className="px-5 py-5 whitespace-nowrap">
                        {canOpen ? (
                          <Link
                            href={b.href}
                            className="font-medium text-foreground after:absolute after:inset-0 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            {formatInVenueTz(b.start, tz, "EEE, MMM d, yyyy")}
                            <span className="sr-only">, {b.client.name} — open booking</span>
                          </Link>
                        ) : (
                          <ReadOnlyNotice className="font-medium text-foreground">
                            {formatInVenueTz(b.start, tz, "EEE, MMM d, yyyy")}
                          </ReadOnlyNotice>
                        )}
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {timeRange(b.start, b.end, tz)}
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="font-medium text-foreground">{b.client.name}</div>
                        {b.client.phone && (
                          <div className="mt-0.5 text-xs text-muted-foreground">{b.client.phone}</div>
                        )}
                      </td>
                      <td className="px-5 py-5 text-foreground">{b.space.name}</td>
                      <td className="hidden px-5 py-5 text-muted-foreground lg:table-cell">
                        {EVENT_TYPE_LABELS[b.eventType]}
                      </td>
                      <td className="px-5 py-5">
                        <StatusBadge status={b.status} />
                        {b.expires && (
                          <div className="mt-1 text-xs whitespace-nowrap text-muted-foreground">
                            expires {b.expires}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-5 text-right font-medium whitespace-nowrap tabular-nums text-foreground">
                        {b.status === "INQUIRY" ? "—" : formatMoney(b.totalCents, venue.currency)}
                      </td>
                      <td className="px-5 py-5 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                        {b.status === "INQUIRY" ? "—" : formatMoney(b.paid, venue.currency)}
                      </td>
                      <td
                        className={cn(
                          "px-5 py-5 text-right whitespace-nowrap tabular-nums",
                          b.outstanding > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {b.status === "INQUIRY" ? "—" : formatMoney(b.outstanding, venue.currency)}
                      </td>
                      {isStaff && (
                        <td className="px-5 py-5 whitespace-nowrap text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5" aria-hidden />
                            Summary only
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((b) => {
              const money = moneySummary(b.status, b.totalCents, b.paid, venue.currency);
              const body = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{b.client.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatInVenueTz(b.start, tz, "MMM d")} · {timeRange(b.start, b.end, tz)}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{b.space.name}</p>
                    </div>
                    {canOpen ? (
                      <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    ) : (
                      <Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Summary only" />
                    )}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3">
                    <div className="min-w-0">
                      <StatusBadge status={b.status} />
                      {b.expires && (
                        <p className="mt-1 text-xs text-muted-foreground">expires {b.expires}</p>
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-right text-sm whitespace-nowrap tabular-nums",
                        money.muted ? "text-muted-foreground" : "font-medium text-foreground"
                      )}
                    >
                      {money.label}
                      {money.amount && <> {money.amount}</>}
                    </p>
                  </div>
                </>
              );
              return (
                <li key={b.id}>
                  {canOpen ? (
                    <Link
                      href={b.href}
                      className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {body}
                    </Link>
                  ) : (
                    <ReadOnlyNotice className="block w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm">{body}</ReadOnlyNotice>
                  )}
                </li>
              );
            })}
          </ul>

          {pages > 1 && <nav aria-label="Booking pages" className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {page} of {pages} · {matching} bookings</p><div className="flex gap-2">{page > 1 && <Link href={listHref(venueSlug, tab, q, page - 1)} className={buttonVariants({ variant: "outline" })}>Previous</Link>}{page < pages && <Link href={listHref(venueSlug, tab, q, page + 1)} className={buttonVariants({ variant: "outline" })}>Next</Link>}</div></nav>}

          {isStaff && (
            <p className="border-t border-border pt-4 text-sm text-muted-foreground md:hidden">
              Staff can view booking summaries but cannot open details.
            </p>
          )}
        </>
      )}
    </div>
  );
}
