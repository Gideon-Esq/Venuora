import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatInVenueTz } from "@/lib/time";
import type { LineItem } from "@/lib/pricing";
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
    <div className="public-page flex flex-1 flex-col bg-zinc-50">
      <BrandedHeader
        name={venue.name}
        logoUrl={venue.logoUrl}
        brandColor={venue.brandColor}
        href={venue.published ? `/v/${venue.slug}` : undefined}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Quote #{quote.number}
          </h1>
          <p className="text-sm text-zinc-500">
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
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-zinc-900">
            {EVENT_TYPE_LABELS[booking.eventType]} — {space.name}
          </h2>
          <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Item label="Starts" value={formatInVenueTz(booking.start, tz)} />
            <Item label="Ends" value={formatInVenueTz(booking.end, tz)} />
            <Item label="Guests" value={String(booking.guestCount)} />
            <Item
              label="Quote valid until"
              value={formatInVenueTz(quote.validUntil, tz, "MMM d, yyyy")}
            />
          </dl>
        </section>

        {/* Price */}
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-zinc-900">Price</h2>
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
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-zinc-900">Deposit due to confirm</span>
              <span className="text-lg font-semibold" style={{ color: venue.brandColor }}>
                {formatMoney(booking.depositCents, currency)}
              </span>
            </div>
            {booking.balanceDueDate && (
              <div className="flex items-baseline justify-between text-zinc-600">
                <span>
                  Balance due by {formatInVenueTz(booking.balanceDueDate, tz, "MMM d, yyyy")}
                </span>
                <span>
                  {formatMoney(booking.totalCents - booking.depositCents, currency)}
                </span>
              </div>
            )}
            {booking.securityDepositCents > 0 && (
              <p className="text-zinc-600">
                Plus a refundable security deposit of{" "}
                {formatMoney(booking.securityDepositCents, currency)}, collected with the balance.
              </p>
            )}
          </div>
        </section>

        {/* Terms */}
        {quote.terms && (
          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-zinc-900">Terms</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-600">
              {quote.terms}
            </p>
          </section>
        )}

        {/* Accept */}
        {!accepted && !inactive && !expired && (
          <div className="mt-8 text-center">
            <AcceptQuoteButton
              token={token}
              brandColor={venue.brandColor}
              label={`Accept & pay ${formatMoney(booking.depositCents, currency)} deposit`}
            />
            <p className="mt-3 text-xs text-zinc-500">
              Paying the deposit confirms your booking and locks the date.
            </p>
          </div>
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
