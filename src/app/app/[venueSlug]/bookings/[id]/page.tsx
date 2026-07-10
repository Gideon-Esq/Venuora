import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Mail, Phone, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { EVENT_TYPE_LABELS, SLOT_TYPE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { paidTowardsBooking, securityHeld } from "@/lib/payments";
import { requireVenue } from "@/lib/tenancy";
import { formatInVenueTz } from "@/lib/time";
import { BookingActions } from "./booking-actions";
import { CopyButton } from "./copy-button";

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

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  SUCCEEDED: "text-emerald-700",
  PENDING: "text-amber-700",
  FAILED: "text-rose-700",
  REFUNDED: "text-zinc-500",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue } = await requireVenue(venueSlug, "MANAGER");

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      client: true,
      space: true,
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!booking || booking.venueId !== venue.id) notFound();

  const tz = venue.timezone;
  const lineItems = (booking.lineItems ?? []) as unknown as LineItem[];
  const paid = paidTowardsBooking(booking.payments);
  const balance = Math.max(0, booking.totalCents - paid);
  const heldSecurity = securityHeld(booking.payments);
  const isPast = booking.end < new Date();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const manageUrl = `${appUrl}/b/${booking.manageToken}`;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div>
        <Link
          href={`/app/${venueSlug}/bookings`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> All bookings
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">
            {booking.client.name} — {booking.space.name}
          </h1>
          <StatusBadge status={booking.status} />
        </div>
        <p className="text-sm text-zinc-500">
          {EVENT_TYPE_LABELS[booking.eventType]} · {SLOT_TYPE_LABELS[booking.slotType]}
          {booking.guestCount > 0 && <> · {booking.guestCount} guests</>}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* -------------------------------------------------- Main column */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Event time</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-base font-medium text-zinc-900">
                {formatInVenueTz(booking.start, tz)} — {formatInVenueTz(booking.end, tz, "h:mm a")}
              </p>
              <p className="text-zinc-500">
                All times shown in the venue&apos;s timezone ({tz}).
              </p>
              <div className="rounded-lg bg-zinc-50 px-3 py-2 text-zinc-700">
                Including setup and teardown buffers:{" "}
                <strong>access from {formatInVenueTz(booking.blockedStart, tz, "h:mm a")}</strong>{" "}
                / <strong>out by {formatInVenueTz(booking.blockedEnd, tz, "h:mm a")}</strong>
                <span className="text-zinc-500">
                  {" "}
                  ({booking.setupBufferMins} min setup · {booking.teardownBufferMins} min teardown)
                </span>
              </div>
              {booking.holdExpiresAt && (booking.status === "PENCILED" || booking.status === "HOLD") && (
                <p className="text-amber-700">
                  Hold expires {formatInVenueTz(booking.holdExpiresAt, tz)}.
                </p>
              )}
              {booking.status === "CANCELLED" && booking.cancelledAt && (
                <p className="text-rose-700">
                  Cancelled {formatInVenueTz(booking.cancelledAt, tz)}
                  {booking.cancelReason && <> — {booking.cancelReason}</>}
                </p>
              )}
              {booking.notes && (
                <div className="rounded-lg border border-zinc-200 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</p>
                  <p className="whitespace-pre-wrap text-zinc-700">{booking.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Price breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                      <th className="py-2 pr-2 font-medium">Item</th>
                      <th className="py-2 pr-2 text-right font-medium">Qty</th>
                      <th className="py-2 pr-2 text-right font-medium">Unit</th>
                      <th className="py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((li, i) => (
                      <tr key={i} className="border-b border-zinc-100 last:border-0">
                        <td className="py-2 pr-2 text-zinc-800">{li.label}</td>
                        <td className="py-2 pr-2 text-right text-zinc-600">{li.qty}</td>
                        <td className="py-2 pr-2 text-right text-zinc-600">
                          {formatMoney(li.unitCents, venue.currency)}
                        </td>
                        <td className="py-2 text-right font-medium text-zinc-900">
                          {formatMoney(li.totalCents, venue.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-1 border-t border-zinc-200 pt-3 text-sm">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span>{formatMoney(booking.subtotalCents, venue.currency)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Tax</span>
                  <span>{formatMoney(booking.taxCents, venue.currency)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-zinc-900">
                  <span>Total</span>
                  <span>{formatMoney(booking.totalCents, venue.currency)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Paid so far</span>
                  <span>{formatMoney(paid, venue.currency)}</span>
                </div>
                <div className="flex justify-between font-medium text-zinc-900">
                  <span>Balance remaining</span>
                  <span>{formatMoney(balance, venue.currency)}</span>
                </div>
                {booking.balanceDueDate && balance > 0 && (
                  <p className="text-xs text-zinc-500">
                    Balance due by {formatInVenueTz(booking.balanceDueDate, tz, "EEE, MMM d yyyy")}.
                  </p>
                )}
                {booking.securityDepositCents > 0 && (
                  <p className="text-xs text-zinc-500">
                    Refundable security deposit: {formatMoney(booking.securityDepositCents, venue.currency)}
                    {" — "}
                    {heldSecurity > 0
                      ? `${formatMoney(heldSecurity, venue.currency)} currently held`
                      : "not held yet"}
                    .
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {booking.payments.length === 0 ? (
                <p className="text-sm text-zinc-500">No payments yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                        <th className="py-2 pr-2 font-medium">Type</th>
                        <th className="py-2 pr-2 text-right font-medium">Amount</th>
                        <th className="py-2 pr-2 font-medium">Status</th>
                        <th className="py-2 pr-2 font-medium">Date</th>
                        <th className="py-2 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {booking.payments.map((p) => (
                        <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                          <td className="py-2 pr-2 text-zinc-800">
                            {PAYMENT_TYPE_LABELS[p.type] ?? p.type}
                          </td>
                          <td className="py-2 pr-2 text-right font-medium text-zinc-900">
                            {formatMoney(p.amountCents, p.currency)}
                          </td>
                          <td className={`py-2 pr-2 ${PAYMENT_STATUS_STYLES[p.status] ?? "text-zinc-600"}`}>
                            {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                          </td>
                          <td className="py-2 pr-2 whitespace-nowrap text-zinc-600">
                            {formatInVenueTz(p.createdAt, tz, "MMM d yyyy, h:mm a")}
                          </td>
                          <td className="py-2 text-zinc-500">{p.reason ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* -------------------------------------------------- Side column */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-medium text-zinc-900">
                <User className="h-4 w-4 text-zinc-400" />
                <Link
                  href={`/app/${venueSlug}/clients/${booking.clientId}`}
                  className="text-indigo-600 hover:underline"
                >
                  {booking.client.name}
                </Link>
              </p>
              {booking.client.phone && (
                <p className="flex items-center gap-2 text-zinc-700">
                  <Phone className="h-4 w-4 text-zinc-400" />
                  <a href={`tel:${booking.client.phone}`} className="hover:underline">
                    {booking.client.phone}
                  </a>
                </p>
              )}
              {booking.client.email && (
                <p className="flex items-center gap-2 text-zinc-700">
                  <Mail className="h-4 w-4 text-zinc-400" />
                  <a href={`mailto:${booking.client.email}`} className="truncate hover:underline">
                    {booking.client.email}
                  </a>
                </p>
              )}
              {booking.client.organization && (
                <p className="flex items-center gap-2 text-zinc-700">
                  <Building2 className="h-4 w-4 text-zinc-400" />
                  {booking.client.organization}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingActions
                slug={venueSlug}
                bookingId={booking.id}
                status={booking.status}
                isPast={isPast}
                currency={venue.currency}
                balanceCents={balance}
                securityHeldCents={heldSecurity}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client booking page</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-zinc-500">
                The client can view their booking, pay, and download documents at this private
                link. Share it any time — by text, WhatsApp or email.
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-zinc-50 px-2 py-1.5 text-xs text-zinc-700">
                  {manageUrl}
                </code>
                <CopyButton value={manageUrl} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
