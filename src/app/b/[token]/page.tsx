import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatInVenueTz } from "@/lib/time";
import { paidTowardsBooking, securityHeld } from "@/lib/payments";
import type { CancellationTier, LineItem } from "@/lib/pricing";
import { EVENT_TYPE_LABELS, SLOT_TYPE_LABELS } from "@/lib/labels";
import { StatusBadge } from "@/components/ui/badge";
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

  return (
    <div className="public-page flex flex-1 flex-col bg-zinc-50">
      <BrandedHeader
        name={venue.name}
        logoUrl={venue.logoUrl}
        brandColor={venue.brandColor}
        href={venue.published ? `/v/${venue.slug}` : undefined}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {/* Success banners */}
        {(sp.confirmed === "1" || sp.paid === "1") && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <p className="text-sm font-medium text-emerald-800">
              {sp.confirmed === "1"
                ? "Deposit received — booking confirmed!"
                : "Payment received — thank you!"}
            </p>
          </div>
        )}

        {booking.status === "HOLD" && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Complete your payment within 15 minutes</p>
              <p className="mt-0.5">
                Your date is held while you pay the deposit
                {booking.holdExpiresAt
                  ? ` — the hold expires at ${formatInVenueTz(booking.holdExpiresAt, tz, "h:mm a")}`
                  : ""}
                . If it lapses, the slot is released to other clients.
              </p>
            </div>
          </div>
        )}

        {booking.status === "CANCELLED" && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" aria-hidden />
            <p className="text-sm text-rose-700">
              This booking was cancelled
              {booking.cancelledAt
                ? ` on ${formatInVenueTz(booking.cancelledAt, tz, "MMM d, yyyy")}`
                : ""}
              {booking.cancelReason ? ` — ${booking.cancelReason}` : ""}.
            </p>
          </div>
        )}

        {/* Event details */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              {EVENT_TYPE_LABELS[booking.eventType]} at {venue.name}
            </h1>
            <StatusBadge status={booking.status} />
          </div>
          <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Item label="Space" value={space.name} />
            <Item label="Booked by" value={booking.client.name} />
            <Item label="Starts" value={formatInVenueTz(booking.start, tz)} />
            <Item label="Ends" value={formatInVenueTz(booking.end, tz)} />
            <Item label="Guests" value={String(booking.guestCount)} />
            <Item label="Booking type" value={SLOT_TYPE_LABELS[booking.slotType]} />
          </dl>
          <p className="mt-3 text-xs text-zinc-500">
            All times shown in the venue&apos;s local time. Access opens {booking.setupBufferMins}{" "}
            minutes before your start time for setup.
          </p>
        </section>

        {/* Price breakdown */}
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-zinc-900">Price breakdown</h2>
          <div className="mt-3">
            <PriceBreakdown
              lineItems={lineItems}
              subtotalCents={booking.subtotalCents}
              taxCents={booking.taxCents}
              totalCents={booking.totalCents}
              currency={currency}
            />
          </div>

          <div className="mt-5 space-y-1.5 rounded-xl bg-zinc-50 p-4 text-sm">
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
        </section>

        {/* Payment history */}
        {visiblePayments.length > 0 && (
          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-zinc-900">Payment history</h2>
            <ul className="mt-3 divide-y divide-zinc-100 text-sm">
              {visiblePayments.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <div>
                    <p className="font-medium text-zinc-900">
                      {PAYMENT_TYPE_LABELS[p.type] ?? p.type}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatInVenueTz(p.createdAt, tz, "MMM d, yyyy 'at' h:mm a")} ·{" "}
                      {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                      {p.reason ? ` · ${p.reason}` : ""}
                    </p>
                  </div>
                  <span className="whitespace-nowrap font-medium text-zinc-900">
                    {p.type === "REFUND" || p.type === "SECURITY_REFUND" ? "−" : ""}
                    {formatMoney(p.amountCents, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Actions */}
        {(canPayBalance || canCancel) && (
          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-zinc-900">Manage this booking</h2>
            <div className="mt-4">
              <BookingActions
                token={token}
                brandColor={venue.brandColor}
                currency={currency}
                canPayBalance={canPayBalance}
                payAmountCents={balanceDue + securityOutstanding}
                includesSecurity={securityOutstanding > 0}
                canCancel={canCancel}
              />
            </div>
          </section>
        )}

        {/* Cancellation policy */}
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-zinc-900">Cancellation policy</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600">
            {cancellationSentences(
              venue.cancellationTiers as unknown as CancellationTier[]
            ).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        {(venue.email || venue.phone) && (
          <p className="mt-6 text-center text-sm text-zinc-500">
            Questions? Contact {venue.name}
            {venue.phone ? ` on ${venue.phone}` : ""}
            {venue.email ? `${venue.phone ? " or" : ""} at ${venue.email}` : ""}.
          </p>
        )}
      </main>

      <PoweredByFooter />
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={strong ? "font-medium text-zinc-900" : "text-zinc-600"}>{label}</span>
      <span className={strong ? "font-semibold text-zinc-900" : "text-zinc-700"}>{value}</span>
    </div>
  );
}
