import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { ONLINE_HOLD_MINUTES } from "@/lib/holds";
import { formatMoney } from "@/lib/money";
import { formatInVenueTz, venueDateStr } from "@/lib/time";
import { paidTowardsBooking, securityHeld } from "@/lib/payments";
import type { CancellationTier, LineItem } from "@/lib/pricing";
import { EVENT_TYPE_LABELS, SLOT_TYPE_LABELS } from "@/lib/labels";
import { StatusBadge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { BrandedHeader, PoweredByFooter } from "@/components/public/branded-header";
import { PriceBreakdown } from "@/components/public/price-breakdown";
import { cancellationSentences } from "@/components/public/policy-summary";
import { BookingActions } from "./booking-actions";

export const metadata: Metadata = { title: "Your booking" };

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  BOOKING_DEPOSIT: "Booking deposit",
  BALANCE: "Balance payment",
  SECURITY_DEPOSIT: "Security deposit",
  SECURITY_REFUND: "Security deposit refund",
  REFUND: "Refund",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  SUCCEEDED: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

const ACTIVE_STATUSES = ["INQUIRY", "QUOTE_SENT", "HOLD", "PENCILED", "CONFIRMED"];

export default async function ManageBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string; confirmed?: string }>;
}) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const booking = await db.booking.findUnique({
    where: { manageToken: token },
    include: { venue: true, space: true, client: true, payments: { orderBy: { createdAt: "asc" } } },
  });
  if (!booking) notFound();

  const { venue, space } = booking;
  const tz = venue.timezone;
  const currency = venue.currency;
  const lineItems = booking.lineItems as unknown as LineItem[];

  const paid = paidTowardsBooking(booking.payments);
  const balanceDue = Math.max(0, booking.totalCents - paid);
  const securityHeldCents = securityHeld(booking.payments);
  const securityOutstanding = Math.max(0, booking.securityDepositCents - securityHeldCents);
  const upcoming = booking.start > new Date();

  const canPayBalance =
    booking.status === "CONFIRMED" && balanceDue + securityOutstanding > 0;
  const canCancel = ACTIVE_STATUSES.includes(booking.status) && upcoming;

  const visiblePayments = booking.payments.filter((p) => p.status !== "PENDING");

  const policySentences = cancellationSentences(
    venue.cancellationTiers as unknown as CancellationTier[]
  );

  return (
    <div className="public-page flex flex-1 flex-col bg-background">
      <BrandedHeader
        name={venue.name}
        logoUrl={venue.logoUrl}
        brandColor={venue.brandColor}
        href={venue.published ? `/v/${venue.slug}` : undefined}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Private booking hub</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{booking.status === "CONFIRMED" ? "Your booking is confirmed" : "Your booking"}</h1><p className="mt-2 text-sm text-muted-foreground">{venue.name} · Booking {booking.id}</p></div><StatusBadge status={booking.status} /></div>
        {booking.status === "CONFIRMED" && <Callout tone="success" icon={CheckCircle2} title="Your date is secure">Payment received and your booking is confirmed.</Callout>}
        {/* Success banners */}
        {((sp.confirmed === "1" && booking.status === "CONFIRMED") || (sp.paid === "1" && paid > 0)) && (
          <Callout tone="success" icon={CheckCircle2}>
            <span className="font-medium">
              {sp.confirmed === "1" && booking.status === "CONFIRMED"
                ? "Deposit received — booking confirmed!"
                : "Payment received — thank you!"}
            </span>
          </Callout>
        )}

        {booking.status === "HOLD" && (
          <Callout
            tone="warning"
            icon={Clock}
            title={`Complete your payment within ${ONLINE_HOLD_MINUTES} minutes`}
          >
            Your date is held while you pay the deposit
            {booking.holdExpiresAt
              ? ` — the hold expires at ${formatInVenueTz(booking.holdExpiresAt, tz, "h:mm a")}`
              : ""}
            . If it lapses, the slot is released to other clients.
          </Callout>
        )}

        {booking.status === "CANCELLED" && (
          <Callout tone="danger" icon={AlertTriangle}>
            This booking was cancelled
            {booking.cancelledAt
              ? ` on ${formatInVenueTz(booking.cancelledAt, tz, "MMM d, yyyy")}`
              : ""}
            {booking.cancelReason ? ` — ${booking.cancelReason}` : ""}.
          </Callout>
        )}

        {/* Event details */}
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Event details</h2>

          </div>
          <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Item label="Space" value={space.name} />
            <Item label="Booked by" value={booking.client.name} />
            <Item label="Date" value={formatInVenueTz(booking.start, tz, "EEEE, MMMM d, yyyy")} />
            <Item label="Time" value={`${formatInVenueTz(booking.start, tz, "h:mm a")}–${formatInVenueTz(booking.end, tz, "h:mm a")}`} />
            <Item label="Event" value={EVENT_TYPE_LABELS[booking.eventType]} />
            <Item label="Setup access" value={formatInVenueTz(booking.blockedStart, tz, "h:mm a")} />
            <Item label="Timezone" value={tz} />
            <Item label="Guests" value={String(booking.guestCount)} />
            <Item label="Booking type" value={SLOT_TYPE_LABELS[booking.slotType]} />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            All times shown in the venue&apos;s local time. Access opens {booking.setupBufferMins}{" "}
            minutes before your start time for setup.
          </p>
        </Card>

        {/* Price breakdown */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Payment summary</h2>
          <details className="mt-3"><summary className="cursor-pointer text-sm text-muted-foreground">View price breakdown</summary>
            <PriceBreakdown
              lineItems={lineItems}
              subtotalCents={booking.subtotalCents}
              taxCents={booking.taxCents}
              totalCents={booking.totalCents}
              currency={currency}
            />
          </details>

          <div className="mt-5 space-y-3 text-sm"><Row label="Total" value={formatMoney(booking.totalCents, currency)} />
            <Row label="Paid so far" value={formatMoney(paid, currency)} />
            <Row
              label={
                booking.balanceDueDate
                  ? `Balance due by ${formatInVenueTz(booking.balanceDueDate, tz, "MMM d, yyyy")}`
                  : "Balance due"
              }
              value={formatMoney(balanceDue, currency)}
              strong={balanceDue > 0}
            />
            {booking.securityDepositCents > 0 && (
              <Row
                label={
                  securityHeldCents > 0
                    ? "Refundable security deposit (held)"
                    : "Refundable security deposit (collected with balance)"
                }
                value={formatMoney(
                  securityHeldCents > 0 ? securityHeldCents : booking.securityDepositCents,
                  currency
                )}
              />
            )}
          </div>
        </Card>

        {/* Payment history */}
        {visiblePayments.length > 0 && (
          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Payment history</h2>
            <ul className="mt-3 divide-y divide-border text-sm">
              {visiblePayments.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {PAYMENT_TYPE_LABELS[p.type] ?? p.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatInVenueTz(p.createdAt, tz, "MMM d, yyyy 'at' h:mm a")} ·{" "}
                      {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                      {p.reason ? ` · ${p.reason}` : ""}
                    </p>
                  </div>
                  <span className="whitespace-nowrap font-medium tabular-nums text-foreground">
                    {p.type === "REFUND" || p.type === "SECURITY_REFUND" ? "−" : ""}
                    {formatMoney(p.amountCents, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Actions */}
        {/* Always mounted so the post-cancel result survives the refresh. */}
              <BookingActions
                token={token}
                brandColor={venue.brandColor}
                currency={currency}
                canPayBalance={canPayBalance}
                payAmountCents={balanceDue + securityOutstanding}
                includesSecurity={securityOutstanding > 0}
                canCancel={canCancel}
                spaceName={space.name}
                dateLabel={formatInVenueTz(booking.start, tz, "EEEE, MMMM d, yyyy")}
                timeLabel={`${formatInVenueTz(booking.start, tz, "h:mm a")}–${formatInVenueTz(
                  booking.end,
                  tz,
                  venueDateStr(booking.end, tz) === venueDateStr(booking.start, tz)
                    ? "h:mm a"
                    : "MMM d, h:mm a"
                )}`}
                securityHeldCents={securityHeldCents}
                policySentences={policySentences}
              />

        {booking.status === "CONFIRMED" && <Card className="p-5 sm:p-6"><h2 className="text-base font-semibold">What happens next</h2><ol className="mt-4 space-y-3 text-sm text-muted-foreground"><li>1. Your date and space are secured.</li>{balanceDue > 0 && <li>2. Pay the remaining {formatMoney(balanceDue, currency)}{booking.balanceDueDate ? ` by ${formatInVenueTz(booking.balanceDueDate, tz, "MMM d")}` : " before your event"}.</li>}<li>3. Arrive for setup at {formatInVenueTz(booking.blockedStart, tz, "h:mm a")}.</li></ol></Card>}
        {/* Cancellation policy */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Cancellation policy</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {policySentences.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>

        {(venue.email || venue.phone) && (
          <p className="text-center text-sm text-muted-foreground">
            Questions? Contact {venue.name}
            {venue.phone ? ` on ${venue.phone}` : ""}
            {venue.email && <a className="ml-2 inline-block py-3 text-primary underline" href={`mailto:${venue.email}`}>Contact venue</a>}.
          </p>
        )}
      </main>

      <PoweredByFooter />
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-muted p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={strong ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-semibold tabular-nums text-foreground" : "tabular-nums text-foreground"}>
        {value}
      </span>
    </div>
  );
}
