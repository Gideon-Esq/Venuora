import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatInVenueTz } from "@/lib/time";
import type { LineItem } from "@/lib/pricing";
import { cancellationSentences } from "@/components/public/policy-summary";
import type { CancellationTier } from "@/lib/pricing";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import { BrandedHeader, PoweredByFooter } from "@/components/public/branded-header";
import { PriceBreakdown } from "@/components/public/price-breakdown";
import { AcceptQuoteButton } from "./accept-button";

export const metadata: Metadata = { title: "Your quote" };

// Quote links are private, unguessable tokens — no published check needed.

export default async function QuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const quote = await db.quote.findUnique({
    where: { token },
    include: {
      booking: { include: { venue: true, space: true, client: true } },
    },
  });
  if (!quote) notFound();

  const { booking } = quote;
  const { venue, space } = booking;
  const tz = venue.timezone;
  const currency = venue.currency;
  const lineItems = booking.lineItems as unknown as LineItem[];
  const expired = quote.validUntil < new Date();
  const inactive = booking.status === "CANCELLED" || booking.status === "EXPIRED";
  const accepted = quote.acceptedAt != null;

  return (
    <div className="public-page flex flex-1 flex-col bg-background">
      <BrandedHeader
        name={venue.name}
        logoUrl={venue.logoUrl}
        brandColor={venue.brandColor}
        href={venue.published ? `/v/${venue.slug}` : undefined}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Quote {quote.number}</p>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Your quote from {venue.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Prepared for {booking.client.name} by {venue.name}
          </p>
        </div>

        {accepted && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <div className="text-sm text-emerald-800">
              <p className="font-semibold">
                Accepted on {formatInVenueTz(quote.acceptedAt!, tz, "MMM d, yyyy")}
              </p>
              <p className="mt-0.5">
                You can pay, track and manage your booking from your booking page.
              </p>
              <Link
                href={`/b/${booking.manageToken}`}
                className="mt-2 inline-block font-semibold underline underline-offset-2"
              >
                Go to my booking
              </Link>
            </div>
          </div>
        )}

        {!accepted && expired && !inactive && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <p className="text-sm text-amber-800">
              This quote expired on {formatInVenueTz(quote.validUntil, tz, "MMM d, yyyy")}. Contact{" "}
              {venue.name}
              {venue.email ? ` at ${venue.email}` : ""} for a fresh one.
            </p>
          </div>
        )}

        {inactive && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            This booking is no longer active. Contact {venue.name} if you&apos;d like to rebook.
          </div>
        )}

        {/* Event summary */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-foreground">
            {EVENT_TYPE_LABELS[booking.eventType]}
          </h2>
          <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Item label="Space" value={space.name} />
            <Item label="Date" value={formatInVenueTz(booking.start, tz, "EEE, MMM d, yyyy")} />
            <Item label="Time" value={`${formatInVenueTz(booking.start, tz, "h:mm a")}–${formatInVenueTz(booking.end, tz, "MMM d, h:mm a")}`} />
            <Item label="Guests" value={String(booking.guestCount)} />
            <Item
              label="Quote valid until"
              value={formatInVenueTz(quote.validUntil, tz, "MMM d, yyyy")}
            />
          </dl>
        </section>

        {/* Price */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Price breakdown</h2>
          <div className="mt-3">
            <PriceBreakdown
              lineItems={lineItems}
              subtotalCents={booking.subtotalCents}
              taxCents={booking.taxCents}
              totalCents={booking.totalCents}
              currency={currency}
            />
          </div>
          <div className="mt-5 space-y-1.5 rounded-xl bg-background p-4 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-foreground">Deposit due to confirm</span>
              <span className="text-lg font-semibold" style={{ color: venue.brandColor }}>
                {formatMoney(booking.depositCents, currency)}
              </span>
            </div>
            {booking.balanceDueDate && (
              <div className="flex items-baseline justify-between text-muted-foreground">
                <span>
                  Balance due by {formatInVenueTz(booking.balanceDueDate, tz, "MMM d, yyyy")}
                </span>
                <span>
                  {formatMoney(booking.totalCents - booking.depositCents, currency)}
                </span>
              </div>
            )}
            {booking.securityDepositCents > 0 && (
              <p className="text-muted-foreground">
                Plus a refundable security deposit of{" "}
                {formatMoney(booking.securityDepositCents, currency)}, collected with the balance.
              </p>
            )}
          </div>
        </section>

        {venue.houseRules && <details className="mt-4 rounded-xl border border-border bg-card p-5"><summary className="cursor-pointer text-sm font-semibold">House rules</summary><p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{venue.houseRules}</p></details>}
        <details className="mt-4 rounded-xl border border-border bg-card p-5"><summary className="cursor-pointer text-sm font-semibold">Cancellation terms</summary><ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">{cancellationSentences(venue.cancellationTiers as unknown as CancellationTier[]).map(sentence => <li key={sentence}>{sentence}</li>)}</ul></details>
        {/* Terms */}
        {quote.terms && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Terms</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {quote.terms}
            </p>
          </section>
        )}

        {/* Accept */}
        {!accepted && !inactive && !expired && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5"><h2 className="text-lg font-semibold">Accept this quote</h2><p className="mb-4 mt-2 text-sm text-muted-foreground">Paying the deposit confirms your booking and secures the date.</p>
            <AcceptQuoteButton
              token={token}
              brandColor={venue.brandColor}
              label={`Accept & pay ${formatMoney(booking.depositCents, currency)} deposit`}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Paying the deposit confirms your booking and locks the date.
            </p>
          </div>
        )}
        {venue.email && <section className="mt-5 rounded-xl border border-border bg-card p-5"><h2 className="text-sm font-semibold">Questions about your quote?</h2><p className="mt-1 text-sm text-muted-foreground">Contact {venue.name} for help with your event details.</p><a href={`mailto:${venue.email}`} className="mt-3 inline-block text-sm text-primary underline">{venue.email}</a></section>}
      </main>

      <PoweredByFooter />
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-muted p-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}
