// Quotes: one-click quote from an inquiry with an "Accept & pay deposit"
// link that converts to a confirmed booking (via HOLD + deposit payment).

import { db } from "./db";
import { sendEmail } from "./email";
import { quoteEmail } from "./email-templates";
import { brandOf, getFullBooking, startDepositPayment, summaryOf } from "./payments";
import { transitionBooking } from "./booking";
import { addDays } from "./time";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function createQuoteForBooking(
  bookingId: string,
  opts: { send: boolean; validDays?: number; terms?: string }
) {
  const booking = await getFullBooking(bookingId);
  const validUntil = addDays(new Date(), opts.validDays ?? 14);

  const last = await db.quote.findFirst({
    where: { venueId: booking.venueId },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const quote = await db.quote.upsert({
    where: { bookingId },
    update: { validUntil, terms: opts.terms ?? booking.venue.houseRules },
    create: {
      venueId: booking.venueId,
      bookingId,
      number: (last?.number ?? 0) + 1,
      validUntil,
      terms: opts.terms ?? booking.venue.houseRules,
    },
  });

  if (booking.status === "INQUIRY") {
    await db.booking.update({ where: { id: bookingId }, data: { status: "QUOTE_SENT" } });
  }

  if (opts.send && booking.client.email) {
    const email = quoteEmail(
      brandOf(booking.venue),
      summaryOf(booking),
      `${appUrl()}/q/${quote.token}`,
      validUntil
    );
    await sendEmail({ to: booking.client.email, ...email, replyTo: booking.venue.email ?? undefined });
    await db.quote.update({ where: { id: quote.id }, data: { sentAt: new Date() } });
  }

  return quote;
}

export type AcceptQuoteResult =
  | { ok: true; paymentUrl: string }
  | { ok: false; error: string };

/** Client clicked "Accept & pay deposit" on the public quote page. */
export async function acceptQuote(token: string): Promise<AcceptQuoteResult> {
  const quote = await db.quote.findUnique({
    where: { token },
    include: { booking: true },
  });
  if (!quote) return { ok: false, error: "Quote not found" };
  if (quote.validUntil < new Date()) {
    return { ok: false, error: "This quote has expired — please contact the venue for a new one." };
  }
  const status = quote.booking.status;
  if (status === "CANCELLED" || status === "EXPIRED") {
    return { ok: false, error: "This booking is no longer active." };
  }

  // Block the slot while the client pays (7-day pencil window).
  if (status === "INQUIRY" || status === "QUOTE_SENT") {
    const res = await transitionBooking(quote.bookingId, "PENCILED", {
      holdExpiresAt: addDays(new Date(), 7),
    });
    if (!res.ok) {
      return { ok: false, error: "Sorry — that date was just booked by someone else. Contact the venue for alternatives." };
    }
  }

  await db.quote.update({ where: { id: quote.id }, data: { acceptedAt: new Date() } });
  const paymentUrl = await startDepositPayment(quote.bookingId);
  return { ok: true, paymentUrl };
}
