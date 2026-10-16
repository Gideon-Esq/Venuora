import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  Clock,
  Hourglass,
  Link2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Undo2,
  Unlock,
  User,
  UserX,
  Users,
  WalletCards,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { BookingStatus } from "@/generated/prisma/enums";
import { Badge, StatusBadge, type BadgeVariant } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { EVENT_TYPE_LABELS, SLOT_TYPE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { paidTowardsBooking, securityHeld } from "@/lib/payments";
import { requireVenue } from "@/lib/tenancy";
import { formatInVenueTz, venueDateStr } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  ActionBar,
  BookingActionsProvider,
  HeaderActions,
  MobileHeaderMenu,
  NoActionsNote,
} from "./booking-actions";
import { CopyButton } from "./copy-button";
import { NextSteps } from "./next-steps";

interface LineItem {
  kind: string;
  label: string;
  qty: number;
  unitCents: number;
  totalCents: number;
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  BOOKING_DEPOSIT: "Deposit",
  BALANCE: "Balance",
  SECURITY_DEPOSIT: "Security deposit",
  SECURITY_REFUND: "Security refund",
  REFUND: "Refund",
};

const REFUND_TYPES = new Set(["REFUND", "SECURITY_REFUND"]);

/** "5:00–10:00 PM", "11:00 AM – 2:00 PM", or "8:00 PM – Sun, Oct 19, 1:00 AM". */
function timeRange(from: Date, to: Date, tz: string): string {
  const crosses = venueDateStr(from, tz) !== venueDateStr(to, tz);
  if (crosses) {
    return `${formatInVenueTz(from, tz, "h:mm a")} – ${formatInVenueTz(to, tz, "EEE, MMM d, h:mm a")}`;
  }
  const sameMeridiem = formatInVenueTz(from, tz, "a") === formatInVenueTz(to, tz, "a");
  return sameMeridiem
    ? `${formatInVenueTz(from, tz, "h:mm")}–${formatInVenueTz(to, tz, "h:mm a")}`
    : `${formatInVenueTz(from, tz, "h:mm a")} – ${formatInVenueTz(to, tz, "h:mm a")}`;
}

function slotPill(
  status: BookingStatus,
  holdExpiresAt: Date | null,
  tz: string
): { label: string; tone: BadgeVariant; text: string; icon: LucideIcon } {
  switch (status) {
    case "CONFIRMED":
    case "COMPLETED":
      return { label: "Slot secure", tone: "success", text: "text-success", icon: CircleCheck };
    case "PENCILED":
    case "HOLD":
      return {
        label: holdExpiresAt
          ? `Slot held until ${formatInVenueTz(holdExpiresAt, tz, status === "HOLD" ? "MMM d, h:mm a" : "EEE, MMM d")}`
          : "Slot held",
        tone: "warning",
        text: "text-warning",
        icon: Hourglass,
      };
    case "INQUIRY":
    case "QUOTE_SENT":
      return {
        label: "Not blocking the calendar",
        tone: "muted",
        text: "text-muted-foreground",
        icon: CircleDashed,
      };
    case "NO_SHOW":
      return { label: "Event date passed", tone: "danger", text: "text-destructive", icon: UserX };
    default:
      return { label: "Slot released", tone: "muted", text: "text-muted-foreground", icon: Unlock };
  }
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue } = await requireVenue(venueSlug, "MANAGER");

  const booking = await db.booking.findUnique({
    where: { id, venueId: venue.id },
    include: {
      client: true,
      space: true,
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!booking || booking.venueId !== venue.id) notFound();

  const tz = venue.timezone;
  const money = (c: number) => formatMoney(c, venue.currency);
  const lineItems = (booking.lineItems ?? []) as unknown as LineItem[];
  const paid = paidTowardsBooking(booking.payments);
  const balance = Math.max(0, booking.totalCents - paid);
  const heldSecurity = securityHeld(booking.payments);
  const securityOutstanding = Math.max(0, booking.securityDepositCents - heldSecurity);
  const isPast = booking.end < new Date();
  const status = booking.status;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const manageUrl = `${appUrl}/b/${booking.manageToken}`;

  const eventTypeLabel = EVENT_TYPE_LABELS[booking.eventType];
  const dateLabel = formatInVenueTz(booking.start, tz, "EEE, MMM d, yyyy");
  const eventTime = timeRange(booking.start, booking.end, tz);
  const pill = slotPill(status, booking.holdExpiresAt, tz);
  const balanceDue = booking.balanceDueDate
    ? formatInVenueTz(booking.balanceDueDate, tz, "MMM d")
    : null;

  const settled = booking.payments.filter((p) => p.status !== "PENDING");
  const pending = booking.payments.filter((p) => p.status === "PENDING");

  // ---------------------------------------------------------------- pieces
  const statusCallout =
    status === "HOLD" ? (
      <Callout tone="warning" icon={Hourglass} title={`Hold expires ${booking.holdExpiresAt ? formatInVenueTz(booking.holdExpiresAt, tz, "EEE, MMM d 'at' h:mm a") : "soon"}`}>
        Slot temporarily reserved while the client completes checkout online.
      </Callout>
    ) : status === "PENCILED" && booking.holdExpiresAt ? (
      <Callout tone="warning" icon={Hourglass} title={`Penciled — hold expires ${formatInVenueTz(booking.holdExpiresAt, tz)}`}>
        The slot is blocked for this client until then, and releases automatically if the
        booking isn&apos;t confirmed.
      </Callout>
    ) : status === "CANCELLED" ? (
      <Callout tone="neutral" icon={XCircle} title={`Cancelled${booking.cancelledAt ? ` ${formatInVenueTz(booking.cancelledAt, tz, "EEE, MMM d yyyy 'at' h:mm a")}` : ""}`}>
        {booking.cancelReason ? <>Reason: {booking.cancelReason}</> : "No reason recorded."}
      </Callout>
    ) : status === "NO_SHOW" ? (
      <Callout tone="danger" icon={UserX} title="Marked as a no-show">
        The client didn&apos;t attend this event.
      </Callout>
    ) : status === "EXPIRED" ? (
      <Callout tone="neutral" icon={Clock} title="Hold expired">
        The hold ran out before the booking was confirmed, so the slot was released.
      </Callout>
    ) : null;

  const nextStepsMessage: Partial<Record<BookingStatus, string>> = {
    INQUIRY: "Send a quote, or pencil the date so nobody else can take it.",
    QUOTE_SENT: "Waiting for the client to accept the quote. Pencil the date if they need time.",
    HOLD: "The client is paying online. The slot frees itself if they don't finish checkout.",
    COMPLETED:
      heldSecurity > 0
        ? `Settle the ${money(heldSecurity)} security deposit to close out this booking.`
        : "All done — nothing left to do for this booking.",
  };

  const nextStepsBody =
    status === "PENCILED" || status === "CONFIRMED" ? (
      <NextSteps
        slug={venueSlug}
        bookingId={booking.id}
        balance={
          booking.totalCents > 0
            ? {
                label: balanceDue
                  ? `Collect remaining balance by ${balanceDue}`
                  : "Collect remaining balance",
                hint: balance > 0 ? `${money(balance)} outstanding · ticks itself once paid` : undefined,
                done: balance === 0,
              }
            : null
        }
        setupLabel={`Confirm setup before ${formatInVenueTz(booking.blockedStart, tz, "h:mm a")}`}
        setupDone={booking.setupDone}
        eventDone={booking.eventDone}
      />
    ) : (
      <p className="text-sm text-muted-foreground">
        {nextStepsMessage[status] ?? "Nothing left to do for this booking."}
      </p>
    );

  const hatch =
    "bg-[repeating-linear-gradient(135deg,var(--color-primary)_0_1.5px,transparent_1.5px_6px)] opacity-35";
  const totalMins =
    (booking.blockedEnd.getTime() - booking.blockedStart.getTime()) / 60_000 || 1;
  const eventMins = (booking.end.getTime() - booking.start.getTime()) / 60_000;

  const scheduleBody = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-muted px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <LogIn className="h-4 w-4 text-primary" aria-hidden /> Setup
          </p>
          <p className="mt-1.5 text-base font-medium tabular-nums">
            {booking.setupBufferMins > 0
              ? timeRange(booking.blockedStart, booking.start, tz)
              : "No setup buffer"}
          </p>
        </div>
        <div className="rounded-lg bg-muted px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <LogOut className="h-4 w-4 text-primary" aria-hidden /> Teardown
          </p>
          <p className="mt-1.5 text-base font-medium tabular-nums">
            {booking.teardownBufferMins > 0
              ? timeRange(booking.end, booking.blockedEnd, tz)
              : "No teardown buffer"}
          </p>
        </div>
      </div>
      <div aria-hidden className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        <div className={hatch} style={{ width: `${(booking.setupBufferMins / totalMins) * 100}%` }} />
        <div className="bg-primary" style={{ width: `${(eventMins / totalMins) * 100}%` }} />
        <div className={hatch} style={{ width: `${(booking.teardownBufferMins / totalMins) * 100}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">
        Access from{" "}
        <strong className="font-medium text-foreground">
          {formatInVenueTz(booking.blockedStart, tz, "h:mm a")}
        </strong>
        , out by{" "}
        <strong className="font-medium text-foreground">
          {formatInVenueTz(booking.blockedEnd, tz, "EEE, MMM d, h:mm a")}
        </strong>{" "}
        · {booking.setupBufferMins} min setup · {booking.teardownBufferMins} min teardown
      </p>
    </div>
  );

  const priceBody = (
    <>
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[420px] text-left text-sm">
          <caption className="sr-only">Price breakdown</caption>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 pr-2 font-medium">Item</th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">Qty</th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">Unit</th>
              <th scope="col" className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                <td className="py-2.5 pr-2 text-foreground">{li.label}</td>
                <td className="py-2.5 pr-2 text-right tabular-nums text-muted-foreground">{li.qty}</td>
                <td className="py-2.5 pr-2 text-right tabular-nums text-muted-foreground">
                  {money(li.unitCents)}
                </td>
                <td className="py-2.5 text-right font-medium tabular-nums">{money(li.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{money(booking.subtotalCents)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>Tax</dt>
          <dd className="tabular-nums">{money(booking.taxCents)}</dd>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(booking.totalCents)}</dd>
        </div>
      </dl>
    </>
  );

  const financialBody = (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between py-1.5">
        <dt className="text-muted-foreground">Total</dt>
        <dd className="font-medium tabular-nums">{money(booking.totalCents)}</dd>
      </div>
      <div className="flex justify-between py-1.5">
        <dt className="text-muted-foreground">Paid</dt>
        <dd className="font-medium tabular-nums">{money(paid)}</dd>
      </div>
      {balance > 0 ? (
        <div className="-mx-3 flex justify-between gap-3 rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-warning">
          <dt>
            <span className="font-semibold">Balance</span>
            {balanceDue && <> due {balanceDue}</>}
          </dt>
          <dd className="font-semibold tabular-nums">{money(balance)}</dd>
        </div>
      ) : (
        <div className="flex justify-between py-1.5">
          <dt className="text-muted-foreground">Balance</dt>
          <dd className="inline-flex items-center gap-1 font-medium text-success">
            <CircleCheck className="h-4 w-4" aria-hidden /> Paid in full
          </dd>
        </div>
      )}
      <div className="flex justify-between gap-3 py-1.5">
        <dt className="text-muted-foreground">Security deposit</dt>
        <dd className="text-right font-medium tabular-nums">
          {booking.securityDepositCents === 0 && heldSecurity === 0
            ? "None"
            : heldSecurity > 0
              ? `${money(heldSecurity)} held`
              : `${money(booking.securityDepositCents)} · not collected yet`}
        </dd>
      </div>
      <div className="flex justify-between gap-3 py-1.5">
        <dt className="text-muted-foreground">Taxes</dt>
        <dd className="text-right font-medium tabular-nums">
          {booking.taxCents > 0 ? `${money(booking.taxCents)} included in total` : "None"}
        </dd>
      </div>
    </dl>
  );

  const ledgerStatus = (p: (typeof booking.payments)[number]) => {
    if (p.status === "SUCCEEDED" && REFUND_TYPES.has(p.type))
      return <Badge variant="muted"><Undo2 aria-hidden />Refunded</Badge>;
    if (p.status === "SUCCEEDED") return <Badge variant="success"><CircleCheck aria-hidden />Paid</Badge>;
    if (p.status === "FAILED") return <Badge variant="danger"><XCircle aria-hidden />Failed</Badge>;
    if (p.status === "REFUNDED") return <Badge variant="muted"><Undo2 aria-hidden />Refunded</Badge>;
    return <Badge variant="warning"><Clock aria-hidden />Not paid</Badge>;
  };

  const ledgerRow = (p: (typeof booking.payments)[number]) => {
    const isRefund = REFUND_TYPES.has(p.type);
    return (
      <tr key={p.id} className="border-b border-border/60 last:border-0 align-top">
        <td className="py-2.5 pr-2">
          <span className="block font-medium text-foreground">
            {PAYMENT_TYPE_LABELS[p.type] ?? p.type}
          </span>
          <span className="block text-xs text-muted-foreground">
            {formatInVenueTz(p.createdAt, tz, "MMM d yyyy, h:mm a")}
          </span>
          {p.reason && <span className="block text-xs text-muted-foreground">{p.reason}</span>}
        </td>
        <td
          className={cn(
            "whitespace-nowrap py-2.5 pr-2 text-right font-medium tabular-nums",
            isRefund ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {isRefund && "−"}
          {formatMoney(p.amountCents, p.currency)}
        </td>
        <td className="py-2.5 text-right">{ledgerStatus(p)}</td>
      </tr>
    );
  };

  const ledgerBody =
    booking.payments.length === 0 ? (
      <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">No payments yet.</p>
    ) : (
      <div className="space-y-3">
        {settled.length > 0 ? (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Payment ledger</caption>
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-2 font-medium">Payment</th>
                <th scope="col" className="py-2 pr-2 text-right font-medium">Amount</th>
                <th scope="col" className="py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>{settled.map(ledgerRow)}</tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No completed payments yet.</p>
        )}
        {pending.length > 0 && (
          <details className="group/ledger rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              <Link2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1">
                {pending.length} payment link{pending.length === 1 ? "" : "s"} generated, not yet paid
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open/ledger:rotate-180" aria-hidden />
            </summary>
            <table className="mt-2 w-full text-left text-sm">
              <caption className="sr-only">Unpaid payment links</caption>
              <tbody>{pending.map(ledgerRow)}</tbody>
            </table>
          </details>
        )}
      </div>
    );

  const notesBody = booking.notes ? (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {booking.notes.split("\n").map((line, i) =>
        line.trim().startsWith("⚠") ? (
          <p key={i} className="rounded-md border border-warning-border bg-warning-soft px-3 py-2 font-medium text-warning">
            {line}
          </p>
        ) : (
          <p key={i} className="whitespace-pre-wrap text-foreground/85">
            {line || " "}
          </p>
        )
      )}
    </div>
  ) : <p className="text-sm text-muted-foreground">No operational notes yet.</p>;

  const clientBody = (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <Link
          href={`/app/${venueSlug}/clients/${booking.clientId}`}
          className="inline-flex items-center gap-2 font-semibold text-foreground hover:text-primary hover:underline"
        >
          <User className="h-4 w-4 text-muted-foreground" aria-hidden />
          {booking.client.name}
        </Link>
        {booking.client.email && (
          <a
            href={`mailto:${booking.client.email}`}
            className="flex min-w-0 items-center gap-2 text-muted-foreground hover:text-foreground hover:underline"
          >
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{booking.client.email}</span>
          </a>
        )}
        {booking.client.phone && (
          <a
            href={`tel:${booking.client.phone}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:underline"
          >
            <Phone className="h-4 w-4 shrink-0" aria-hidden />
            {booking.client.phone}
          </a>
        )}
        {booking.client.organization && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4 shrink-0" aria-hidden />
            {booking.client.organization}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:gap-3 md:flex-col md:items-stretch xl:flex-row xl:items-center">
        <CopyButton
          value={manageUrl}
          label="Copy private client link"
          icon="link"
          size="default"
          toastMessage="Private client link copied"
          className="shrink-0"
        />
        <p className="text-xs text-muted-foreground">
          Share this private booking page with the client.
        </p>
      </div>
    </div>
  );

  // -------------------------------------------------------------- layout
  return (
    <BookingActionsProvider
      data={{
        slug: venueSlug,
        bookingId: booking.id,
        status,
        isPast,
        currency: venue.currency,
        paidCents: paid,
        balanceCents: balance,
        depositCents: booking.depositCents,
        securityHeldCents: heldSecurity,
        securityOutstandingCents: securityOutstanding,
        manageToken: booking.manageToken,
        manageUrl,
        clientName: booking.client.name,
        clientEmail: booking.client.email,
        spaceName: booking.space.name,
        eventTypeLabel,
        timezone: tz,
        eventDate: dateLabel,
        eventTime,
        totalCents: booking.totalCents,
      }}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header — desktop */}
        <div className="hidden flex-wrap items-start justify-between gap-x-6 gap-y-4 md:flex">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <li>
                  <Link href={`/app/${venueSlug}/bookings`} className="hover:text-foreground hover:underline">
                    Bookings
                  </Link>
                </li>
                <li aria-hidden>
                  <ChevronRight className="h-4 w-4" />
                </li>
                <li aria-current="page" className="truncate font-medium text-foreground">
                  {booking.id}
                </li>
              </ol>
            </nav>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">
                {booking.client.name}
              </h1>
              <StatusBadge status={status} />
            </div>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              {eventTypeLabel} · {SLOT_TYPE_LABELS[booking.slotType]}
            </p>
          </div>
          <HeaderActions />
        </div>

        {/* Header — mobile */}
        <div className="md:hidden">
          <Link
            href={`/app/${venueSlug}/bookings`}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Bookings
          </Link>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <StatusBadge status={status} />
              <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
                {booking.client.name}
              </h1>
              <p className="mt-1 text-[15px] text-muted-foreground">
                {eventTypeLabel} · {SLOT_TYPE_LABELS[booking.slotType]}
              </p>
            </div>
            <MobileHeaderMenu />
          </div>
          <NoActionsNote className="mt-3" />
        </div>

        {statusCallout}
        {["INQUIRY", "QUOTE_SENT", "COMPLETED", "EXPIRED", "CANCELLED", "NO_SHOW"].includes(status) && <section className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{status === "QUOTE_SENT" ? "Quote sent" : status.replaceAll("_", " ")}</p><h2 className="mt-2 text-lg font-semibold">{booking.client.name}</h2></div><StatusBadge status={status} /></div><dl className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">Event</dt><dd className="mt-1 text-sm font-medium">{dateLabel}</dd></div><div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">Space</dt><dd className="mt-1 text-sm font-medium">{booking.space.name}</dd></div></dl><p className="mt-4 text-sm text-muted-foreground">{status === "INQUIRY" ? "No slot secured. Send a quote to move this inquiry forward." : status === "QUOTE_SENT" ? "A quote has been created. The space is not held until a hold or confirmation is saved." : status === "COMPLETED" ? balance > 0 ? `${money(balance)} remains outstanding.` : "Booking balance settled." : status === "EXPIRED" ? "The hold has expired and the slot is inactive." : status === "NO_SHOW" ? "The event was recorded as a no-show." : "This booking is closed. Its cancellation and refund records remain below."}</p>{heldSecurity > 0 && <p className="mt-2 text-sm">Security deposit: {money(heldSecurity)} held</p>}</section>}

        {/* Summary strip — desktop */}
        <Card className="hidden md:block">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 p-6">
            <dl className="flex flex-1 flex-wrap items-stretch gap-x-8 gap-y-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</dt>
                <dd className="mt-1 font-semibold">{dateLabel}</dd>
                <dd className="text-sm text-muted-foreground tabular-nums">{eventTime}</dd>
              </div>
              <div className="border-l border-border pl-8">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time zone</dt>
                <dd className="mt-1 font-semibold">{tz}</dd>
              </div>
              <div className="border-l border-border pl-8">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Space</dt>
                <dd className="mt-1 font-semibold">{booking.space.name}</dd>
              </div>
              <div className="border-l border-border pl-8">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guests</dt>
                <dd className="mt-1 font-semibold">
                  {booking.guestCount > 0 ? `${booking.guestCount} guests` : "Not set"}
                </dd>
              </div>
            </dl>
            <Badge variant={pill.tone} className="rounded-full px-3 py-1.5 text-sm [&_svg]:h-4 [&_svg]:w-4">
              <pill.icon aria-hidden />
              {pill.label}
            </Badge>
          </div>
        </Card>

        {/* Summary card — mobile 2×2 */}
        <Card className="md:hidden">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 p-5">
            <SummaryTile icon={CalendarDays} label="Date" value={dateLabel} />
            <SummaryTile icon={Clock} label="Event time" value={eventTime} sub={tz} />
            <SummaryTile
              icon={MapPin}
              label="Space"
              value={booking.space.name}
              sub={booking.guestCount > 0 ? `${booking.guestCount} guests` : undefined}
            />
            <SummaryTile icon={ShieldCheck} label="Booking security" value={pill.label} valueClass={pill.text} />
          </dl>
        </Card>

        {/* Body — mobile: collapsible sections */}
        <div className="space-y-3 md:hidden">
          <MobileSection title="What happens next" defaultOpen>
            {nextStepsBody}
          </MobileSection>
          <MobileSection title="Money" defaultOpen>
            {financialBody}
            <h3 className="mb-2 mt-6 text-sm font-semibold">Price breakdown</h3>
            {priceBody}
          </MobileSection>
          <MobileSection title="Schedule">{scheduleBody}</MobileSection>
          <MobileSection title="Payment history">{ledgerBody}</MobileSection>
          {notesBody && <MobileSection title="Notes">{notesBody}</MobileSection>}
          <MobileSection title="Client">{clientBody}</MobileSection>
        </div>

        {/* Body — tablet/desktop: two columns */}
        <div className="hidden gap-6 md:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>What happens next</CardTitle>
                <CardDescription>Keep the booking moving toward a ready event.</CardDescription>
              </CardHeader>
              <CardContent>{nextStepsBody}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
              </CardHeader>
              <CardContent>{scheduleBody}</CardContent>
            </Card>
            <details className="rounded-xl border border-border bg-card"><summary className="cursor-pointer px-6 py-4 text-sm font-semibold">Price breakdown</summary><div className="border-t border-border p-6">{priceBody}</div></details>
            {notesBody && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>{notesBody}</CardContent>
              </Card>
            )}
          </div>
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Financial summary</CardTitle>
                <WalletCards className="h-5 w-5 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>{financialBody}</CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Payment ledger</CardTitle>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {settled.length} payment{settled.length === 1 ? "" : "s"}
                </span>
              </CardHeader>
              <CardContent>{ledgerBody}</CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Client</CardTitle>
                <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>{clientBody}</CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ActionBar />
    </BookingActionsProvider>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className={cn("mt-1 break-words font-semibold", valueClass)}>{value}</dd>
        {sub && <dd className="break-words text-xs text-muted-foreground">{sub}</dd>}
      </div>
    </div>
  );
}

function MobileSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group/section rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(27,26,34,0.04)]"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-4 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        <ChevronDown
          className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open/section:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-border px-5 py-4">{children}</div>
    </details>
  );
}
