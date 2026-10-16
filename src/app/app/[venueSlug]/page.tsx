import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  CreditCard,
  DoorOpen,
  Hourglass,
  ListChecks,
  MessageSquare,
  Sparkles,
  Sun,
  RefreshCw,
  LockKeyhole,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { paidTowardsBooking } from "@/lib/payments";
import { requireVenue, roleAtLeast } from "@/lib/tenancy";
import { addDays, formatInVenueTz, venueDateStr, venueLocalToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";
import { toTourView } from "./tours/tour-shared";
import { TourStatusBadge } from "./tours/tour-drawer";
import {
  ChecklistSwitch,
  ConfirmTourButton,
  PaymentLinkItem,
  PendingTourRail,
} from "./_dashboard/dashboard-client";


export const metadata = { title: "This week" };

const ROLE_VIEW = { OWNER: "Owner view", MANAGER: "Manager view", STAFF: "Staff view" } as const;

/** UTC instant of venue-local midnight `offsetDays` after the venue-local day of `ref`. */
function venueMidnight(ref: Date, tz: string, offsetDays: number): Date {
  const todayStart = venueLocalToUtc(tz, venueDateStr(ref, tz), "00:00");
  // Land at local noon of the target day so DST shifts can't change the date.
  const target = venueDateStr(new Date(addDays(todayStart, offsetDays).getTime() + 12 * 3_600_000), tz);
  return venueLocalToUtc(tz, target, "00:00");
}

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
  const { venue, role, impersonating } = await requireVenue(venueSlug);
  const canManage = roleAtLeast(role, "MANAGER");
  const setupMode = role === "OWNER" && !venue.published;
  const tz = venue.timezone;
  const now = new Date();
  const slug = venue.slug;
  const base = `/app/${slug}`;
  const money = (c: number) => formatMoney(c, venue.currency);

  const todayStart = venueMidnight(now, tz, 0);
  const tomorrowStart = venueMidnight(now, tz, 1);
  const lastDayStart = venueMidnight(now, tz, 6);
  const weekEnd = venueMidnight(now, tz, 7);
  const month = monthBoundsUtc(now, tz);
  const paymentSelect = { select: { type: true, status: true, amountCents: true } } as const;

  const [
    weekBookings,
    pendingTours,
    todaysTours,
    upcomingOpen,
    expiringHolds,
    confirmedThisMonth,
    revenueAgg,
    inquiryCount,
    spaces,
    setupCounts,
    pendingTourCount,
  ] = await Promise.all([
    // Events overlapping today through +6 days (an event that started
    // yesterday and runs into today still appears on today's schedule).
    db.booking.findMany({
      where: {
        venueId: venue.id,
        status: { in: ["PENCILED", "CONFIRMED"] },
        start: { lt: weekEnd },
        end: { gt: todayStart },
      },
      include: {
        client: { select: { name: true, email: true } },
        space: { select: { name: true, color: true } },
        payments: paymentSelect,
      },
      orderBy: { start: "asc" },
    }),
    db.tourRequest.findMany({
      where: { venueId: venue.id, status: "PENDING" },
      orderBy: { requestedAt: "asc" },
      take: 8,
    }),
    db.tourRequest.findMany({
      where: {
        venueId: venue.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        requestedAt: { gte: todayStart, lt: tomorrowStart },
      },
      orderBy: { requestedAt: "asc" },
    }),
    // Upcoming penciled/confirmed bookings: balances owed + snapshot total.
    db.booking.findMany({
      where: { venueId: venue.id, status: { in: ["PENCILED", "CONFIRMED"] }, end: { gt: todayStart } },
      select: {
        id: true,
        status: true,
        start: true,
        totalCents: true,
        balanceDueDate: true,
        client: { select: { name: true, email: true } },
        payments: paymentSelect,
      },
      orderBy: { start: "asc" },
    }),
    canManage
      ? db.booking.findMany({
          where: { venueId: venue.id, status: "PENCILED", holdExpiresAt: { gte: now, lt: addDays(now, 3) } },
          select: { id: true, holdExpiresAt: true, client: { select: { name: true } } },
          orderBy: { holdExpiresAt: "asc" },
        })
      : Promise.resolve([]),
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
    db.space.findMany({ where: { venueId: venue.id }, select: { id: true, name: true } }),
    setupMode
      ? Promise.all([
          db.space.count({ where: { venueId: venue.id, active: true } }),
          db.ratePlan.count({ where: { space: { venueId: venue.id } } }),
          db.venueMember.count({ where: { venueId: venue.id } }),
        ])
      : Promise.resolve(null),
    db.tourRequest.count({ where: { venueId: venue.id, status: "PENDING" } }),
  ]);

  const spaceNames = new Map(spaces.map((s) => [s.id, s.name]));
  const revenueThisMonth = revenueAgg._sum.amountCents ?? 0;

  const withMoney = <T extends { totalCents: number; payments: { type: string; status: string; amountCents: number }[] }>(
    b: T
  ) => {
    const paid = paidTowardsBooking(b.payments);
    return { ...b, paid, outstanding: Math.max(0, b.totalCents - paid) };
  };

  const upcomingMoney = upcomingOpen.map(withMoney);
  const outstandingTotal = upcomingMoney.reduce((s, b) => s + b.outstanding, 0);
  const balancesOwed = upcomingMoney
    .filter((b) => b.status === "CONFIRMED" && b.outstanding > 0)
    .sort(
      (a, b) =>
        (a.balanceDueDate ?? a.start).getTime() - (b.balanceDueDate ?? b.start).getTime()
    );

  const todayEvents = weekBookings.filter((b) => b.start < tomorrowStart).map(withMoney);
  const comingUp = weekBookings.filter((b) => b.start >= tomorrowStart).map(withMoney);
  const tourViews = pendingTours.map((t) => toTourView(t, { tz, now, spaceNames }));


  const owner = role === "OWNER";
  const emptyVenue = setupMode && weekBookings.length === 0 && todaysTours.length === 0 && inquiryCount === 0 && pendingTourCount === 0 && upcomingMoney.length === 0;
  const setupSteps = setupCounts ? [
    { title: "Add venue details", href: `${base}/settings/general`, done: !!(venue.email || venue.addressLine1) },
    { title: "Add a space", href: `${base}/spaces/new`, done: setupCounts[0] > 0 },
    { title: "Set booking preferences", href: `${base}/spaces`, done: setupCounts[1] > 0 && venue.onboardingStep >= 5 },
    { title: "Connect payments", href: `${base}/settings/payments`, done: venue.stripeChargesEnabled },
    { title: "Invite your team", href: `${base}/settings/team`, done: setupCounts[2] > 1, optional: true },
  ] : [];
  const setupDone = setupSteps.filter((step) => step.done).length;
  const topBalance = balancesOwed[0];
  const attentionCount = Number(inquiryCount > 0) + Number(!!topBalance) + Number(pendingTourCount > 0) + Number(expiringHolds.length > 0);
  const card = "rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(27,26,34,0.10)]";
  const compactAction = "max-sm:min-h-11 max-sm:border-0 max-sm:bg-transparent max-sm:px-1 max-sm:text-primary max-sm:shadow-none";
  const timeRange = (b: { start: Date; end: Date }) => `${formatInVenueTz(b.start, tz, b.start < todayStart ? "EEE h:mm a" : "h:mm a")}–${formatInVenueTz(b.end, tz, b.end >= tomorrowStart ? "EEE h:mm a" : "h:mm a")}`;

  const attentionContent = (
    <div className={cn(card, "overflow-hidden", !owner && "lg:border-0 lg:shadow-none")}>
      {attentionCount === 0 ? <div className="flex items-center gap-3 p-5 text-sm text-muted-foreground"><CircleCheck className="h-5 w-5 text-success" aria-hidden />You’re all caught up.</div> : (
        <ul className={cn("divide-y divide-border", !owner && "lg:space-y-3 lg:divide-y-0")}>
          {inquiryCount > 0 && <li className={cn("flex items-center gap-3 px-4 py-4 sm:px-5", !owner && "lg:rounded-lg lg:bg-muted")}>
            <MessageSquare className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1"><p className="font-medium">{inquiryCount} new {inquiryCount === 1 ? "inquiry" : "inquiries"}</p><p className="hidden text-sm text-muted-foreground sm:block">Waiting for your response</p></div>
            <Link href={`${base}/bookings?status=inquiries`} className={cn(buttonVariants({ size: "sm" }), compactAction)}><span className="sm:hidden">View</span><span className="hidden sm:inline">View inquiries</span></Link>
          </li>}
          {topBalance && <li>
            {canManage ? <PaymentLinkItem slug={slug} bookingId={topBalance.id} clientName={topBalance.client.name} hasEmail={!!topBalance.client.email} label="Send payment link" amountLabel={money(topBalance.outstanding)} dueLabel={formatInVenueTz(topBalance.balanceDueDate ?? topBalance.start, tz, "MMM d")} className={cn("px-4 py-4 sm:px-5", !owner && "lg:rounded-lg lg:bg-muted")} buttonClassName={compactAction}>
              <CreditCard className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1"><p className="font-medium">{balancesOwed.length} outstanding {balancesOwed.length === 1 ? "balance" : "balances"}</p><p className="text-sm text-muted-foreground">{topBalance.client.name} · {money(topBalance.outstanding)} due {formatInVenueTz(topBalance.balanceDueDate ?? topBalance.start, tz, "MMM d")}</p></div>
            </PaymentLinkItem> : <div className="flex gap-3 px-4 py-4 sm:px-5"><CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden /><div><p className="font-medium">{topBalance.client.name} · {money(topBalance.outstanding)} outstanding</p><p className="text-xs text-muted-foreground">Informational only</p></div></div>}
          </li>}
          {pendingTourCount > 0 && <li className={cn("flex items-center gap-3 px-4 py-4 sm:px-5", !owner && "lg:rounded-lg lg:bg-muted")}>
            <CalendarClock className="h-5 w-5 shrink-0 text-primary" aria-hidden /><div className="min-w-0 flex-1"><p className="font-medium">{pendingTourCount} pending tours</p><p className="hidden text-sm text-muted-foreground sm:block">Requests need {canManage ? "your confirmation" : "a manager’s review"}</p></div>
            {canManage ? <Link href={`${base}/tours`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), compactAction)}>Review tours</Link> : <a href="#tours-heading" className="text-sm font-medium text-primary">View details</a>}
          </li>}
          {expiringHolds.length > 0 && <li className="flex items-center gap-3 px-4 py-4 sm:px-5"><Hourglass className="h-5 w-5 shrink-0 text-warning" aria-hidden /><div className="min-w-0 flex-1"><p className="font-medium">{expiringHolds.length} holds expire soon</p><p className="text-sm text-muted-foreground">{expiringHolds[0].client.name}</p></div><Link href={`${base}/bookings/${expiringHolds[0].id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>Review</Link></li>}
        </ul>
      )}
    </div>
  );

  const todayContent = todayEvents.length === 0 && todaysTours.length === 0 ? (
    <EmptyPanel icon={CalendarDays} title="Nothing happening today" description="Your schedule will appear here once you add a booking or tour.">
      <Link href={`${base}/calendar`} className={buttonVariants({ variant: "outline" })}><Plus className="h-4 w-4" aria-hidden />{canManage ? "Add booking" : "Open calendar"}</Link>
    </EmptyPanel>
  ) : <div className="space-y-3">
    {todayEvents.map((b) => <article key={b.id} className={cn(card, "p-5 sm:p-6", !owner && "lg:border-0 lg:p-0 lg:shadow-none")}>
      <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-semibold">{b.client.name}<span className="hidden xl:inline"> — {EVENT_TYPE_LABELS[b.eventType]}</span></h3><StatusBadge status={b.status} className="shrink-0" /></div>
      <p className="mt-1.5 text-sm text-muted-foreground">{timeRange(b)} · {b.space.name}</p>
      <div className="my-5 flex flex-wrap items-center justify-between gap-2 border-y border-border py-3 text-sm"><span>Paid {money(b.paid)} of {money(b.totalCents)}</span><span className={cn("font-medium", b.outstanding === 0 && "text-success")}>{b.outstanding > 0 ? `${money(b.outstanding)} remaining` : "Paid in full"}</span></div>
      <div className={cn("grid grid-cols-2 gap-3 rounded-lg bg-muted p-3", !owner && "lg:grid-cols-1 lg:bg-transparent lg:p-0")}>
        <ChecklistSwitch slug={slug} bookingId={b.id} field="setupDone" done={b.setupDone} label="Setup completed" shortLabel="Setup" hint="Before the event" readOnly={!canManage} compact={owner} />
        <ChecklistSwitch slug={slug} bookingId={b.id} field="eventDone" done={b.eventDone} label="Teardown completed" shortLabel="Teardown" hint="After the event" readOnly={!canManage} compact={owner} />
      </div>
      <Link href={`${base}/bookings/${b.id}`} className={cn(buttonVariants({ variant: "outline" }), "mt-5 max-sm:w-full max-sm:border-primary max-sm:bg-primary max-sm:text-white")}>Open booking <ArrowRight className="h-4 w-4" aria-hidden /></Link>
    </article>)}
    {todaysTours.map((t) => <div key={t.id} className={cn(card, "flex items-center gap-3 p-4 sm:p-5")}><span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary sm:inline-flex"><DoorOpen className="h-4 w-4" aria-hidden /></span><div className="min-w-0 flex-1"><p className="font-medium">Venue walk-through · {t.name}</p><p className="text-sm text-muted-foreground">{formatInVenueTz(t.requestedAt, tz, "h:mm a")}{t.spaceId && spaceNames.get(t.spaceId) ? ` · ${spaceNames.get(t.spaceId)}` : ""}</p></div>{t.status === "PENDING" && canManage ? <ConfirmTourButton slug={slug} tour={t} /> : <TourStatusBadge status={t.status} />}</div>)}
  </div>;

  const upcomingContent = comingUp.length === 0 ? <EmptyPanel icon={CalendarClock} title="No upcoming events yet" description="Your penciled and confirmed bookings will appear here." /> : (
    <ul className={cn(card, "divide-y divide-border overflow-hidden max-sm:flex max-sm:snap-x max-sm:snap-mandatory max-sm:gap-3 max-sm:overflow-x-auto max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:pb-2 max-sm:shadow-none max-sm:divide-y-0", !owner && "lg:border-0 lg:shadow-none")}>
      {comingUp.map((b) => {
        const penciled = b.status === "PENCILED";
        const detail = penciled ? `Penciled${b.holdExpiresAt ? ` · expires ${formatInVenueTz(b.holdExpiresAt, tz, "MMM d 'at' h:mm a")}` : ""}` : b.outstanding > 0 ? `${money(b.outstanding)} outstanding` : "Paid";
        const text = <div className="min-w-0 flex-1"><Link href={`${base}/bookings/${b.id}`} className="font-medium hover:text-primary">{b.client.name}</Link><p className="mt-1 text-sm text-muted-foreground">{formatInVenueTz(b.start, tz, "EEE, MMM d")}</p><p className={cn("mt-1 text-sm", penciled ? "text-warning" : "text-muted-foreground")}>{detail}</p></div>;
        return <li key={b.id} className={cn("max-sm:w-[85%] max-sm:min-w-[240px] max-sm:shrink-0 max-sm:snap-start max-sm:rounded-xl max-sm:border max-sm:border-border", penciled ? "max-sm:bg-warning-soft" : "max-sm:bg-card")}>
          {canManage && !penciled && b.outstanding > 0 ? <PaymentLinkItem slug={slug} bookingId={b.id} clientName={b.client.name} hasEmail={!!b.client.email} label="Send payment link" amountLabel={money(b.outstanding)} dueLabel={b.balanceDueDate ? formatInVenueTz(b.balanceDueDate, tz, "MMM d") : undefined} className="p-4 sm:px-5" rowClassName="max-sm:flex-col max-sm:items-start">{text}</PaymentLinkItem> : <div className="flex items-center gap-3 p-4 sm:px-5">{text}<StatusBadge status={b.status} className="hidden shrink-0 sm:inline-flex" /></div>}
        </li>;
      })}
    </ul>
  );

  const toursContent = <div className={cn(card, "p-5", !owner && "lg:border-0 lg:p-0 lg:shadow-none")}>
    {tourViews.length > 0 ? <PendingTourRail slug={slug} tours={tourViews} canManage={canManage} horizontal={!owner} /> : <p className="py-6 text-center text-sm text-muted-foreground">No pending tours.</p>}
    {pendingTourCount > tourViews.length && <p className="mt-4 text-sm text-muted-foreground">Showing the first {tourViews.length} of {pendingTourCount} requests.</p>}
  </div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="flex items-center gap-3"><h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">This week</h1><Badge variant="accent" className="max-sm:hidden">{ROLE_VIEW[role]}</Badge></div><p className="mt-1 text-[15px] text-muted-foreground">{formatInVenueTz(todayStart, tz, "EEE, MMM d")} – {formatInVenueTz(lastDayStart, tz, "EEE, MMM d")}</p></div>
        <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex"><RefreshCw className="h-3.5 w-3.5" aria-hidden />Live venue activity</span>
      </div>
      {impersonating && <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" aria-hidden />Super-admin access · changes are recorded in the audit log.</div>}
      {setupMode && <div className="flex items-center gap-4 rounded-xl border border-primary/15 bg-accent p-5 shadow-sm sm:p-6"><span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white sm:inline-flex"><Sparkles className="h-6 w-6" aria-hidden /></span><div className="min-w-0 flex-1"><p className="font-semibold sm:text-lg">{emptyVenue ? "Your venue is almost ready" : "Finish setup to start accepting bookings"}</p><p className="mt-1 text-sm text-muted-foreground">{setupDone} of {setupSteps.length} complete</p></div><Link href={`${base}/onboarding`} className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>Review setup</Link></div>}

      <div className={cn("grid items-start gap-8", owner ? "md:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-3 lg:gap-6")}>
        {emptyVenue ? <Section id="attention-heading" title="Needs attention" aside={`${setupSteps.length} steps`} className="md:col-span-2"><ul className={cn(card, "divide-y divide-border overflow-hidden")}>{setupSteps.map((step) => <li key={step.title}><Link href={step.href} className="flex min-h-16 items-center gap-4 px-5 py-4 hover:bg-muted/50 sm:px-6"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">{step.done ? <CircleCheck className="h-4 w-4 text-success" aria-hidden /> : <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />}</span><span className="min-w-0 flex-1 font-medium">{step.title}</span><Badge variant={step.done ? "success" : step.optional ? "accent" : "muted"}>{step.done ? "Done" : step.optional ? "Optional" : "Incomplete"}</Badge><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden /></Link></li>)}</ul></Section> : <Section id="attention-heading" title="Needs attention" icon={CircleAlert} enclosed={!owner} aside={`${attentionCount} items`} className={owner ? "md:col-start-1" : undefined}>{attentionContent}</Section>}
        <Section id="today-heading" title="Today" icon={Sun} enclosed={!owner} aside={owner ? formatInVenueTz(now, tz, "EEEE, MMM d") : undefined} className={cn(owner && "md:col-start-1", emptyVenue && "md:col-auto")}>{todayContent}</Section>
        <Section id="upcoming-heading" title="Coming up" icon={ListChecks} enclosed={!owner} className={cn(owner && "md:col-start-1", emptyVenue && "md:col-auto")}>{upcomingContent}</Section>
        {!emptyVenue && <Section id="tours-heading" title="Pending tours" icon={CalendarClock} enclosed={!owner} className={owner ? "md:col-start-2 md:row-start-1 md:row-span-3" : "lg:col-span-3"} aside={canManage && pendingTourCount > 0 ? <Link href={`${base}/tours`} className="text-primary hover:underline">All tours</Link> : undefined}>{toursContent}</Section>}
        <Section id="snapshot-heading" title="Business snapshot" icon={ChartColumn} className={owner && !emptyVenue ? "md:col-start-1" : owner ? "md:col-span-2" : "lg:col-span-3"}><div className={cn("grid grid-cols-2 gap-3 sm:gap-4", "xl:grid-cols-4")}><StatTile label="Confirmed this month" value={String(confirmedThisMonth)} /><StatTile label="Collected this month" value={money(revenueThisMonth)} /><StatTile label="Pending inquiries" value={String(inquiryCount)} /><StatTile label="Outstanding balance" value={money(outstandingTotal)} /></div></Section>
      </div>
      {todayEvents.length > 0 && <><div aria-hidden className="h-16 sm:hidden" /><div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"><Link href={`${base}/calendar?view=day`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>Open today</Link></div></>}
    </div>
  );
}

function Section({ id, title, icon: Icon, aside, enclosed = false, className, children }: { id: string; title: string; icon?: LucideIcon; aside?: React.ReactNode; enclosed?: boolean; className?: string; children: React.ReactNode }) {
  return <section aria-labelledby={id} className={cn("min-w-0", enclosed && "lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-6 lg:shadow-sm", className)}><div className="mb-3 flex items-center justify-between gap-3"><h2 id={id} className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground", enclosed && "lg:text-lg lg:normal-case lg:tracking-normal lg:text-foreground")}>{Icon && <Icon className={cn("hidden h-5 w-5 text-primary", enclosed && "lg:block")} aria-hidden />}{title}</h2>{aside && <span className="text-xs text-muted-foreground">{aside}</span>}</div>{children}</section>;
}

function EmptyPanel({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children?: React.ReactNode }) {
  return <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-8 text-center shadow-sm"><span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary"><Icon className="h-6 w-6" aria-hidden /></span><h3 className="font-semibold">{title}</h3><p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>{children && <div className="mt-5">{children}</div>}</div>;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-28 flex-col-reverse justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(27,26,34,0.10)] sm:p-5 md:flex-col"><p className="text-sm text-muted-foreground">{label}</p><p className="break-words text-2xl font-semibold leading-tight tracking-tight tabular-nums sm:text-[28px]">{value}</p></div>;
}
