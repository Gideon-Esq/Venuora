// Venue-branded transactional emails. Every template carries the VENUE's
// name/logo/color — clients should never see the platform's brand.

import { formatMoney } from "./money";
import { formatInVenueTz } from "./time";

export interface VenueBrand {
  name: string;
  logoUrl: string | null;
  brandColor: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  currency: string;
}

export interface BookingSummary {
  clientName: string;
  spaceName: string;
  eventType: string;
  start: Date;
  end: Date;
  guestCount: number;
  totalCents: number;
  depositCents: number;
  balanceDueDate: Date | null;
  securityDepositCents: number;
  manageUrl: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function layout(brand: VenueBrand, bodyHtml: string): string {
  const logo = brand.logoUrl
    ? `<img src="${brand.logoUrl}" alt="${esc(brand.name)}" height="40" style="height:40px;border-radius:8px" />`
    : `<div style="font-size:22px;font-weight:700;color:#fff">${esc(brand.name)}</div>`;
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
      <tr><td style="background:${brand.brandColor};border-radius:12px 12px 0 0;padding:20px 28px">${logo}</td></tr>
      <tr><td style="background:#ffffff;border-radius:0 0 12px 12px;padding:28px;line-height:1.6;font-size:15px">
        ${bodyHtml}
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0" />
        <p style="color:#71717a;font-size:13px;margin:0">
          ${esc(brand.name)}${brand.phone ? ` · ${esc(brand.phone)}` : ""}${brand.email ? ` · ${esc(brand.email)}` : ""}
        </p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export function button(brand: VenueBrand, href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="background:${brand.brandColor};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">${esc(label)}</a></p>`;
}

export function bookingTable(brand: VenueBrand, b: BookingSummary): string {
  const rows: [string, string][] = [
    ["Space", b.spaceName],
    ["Date & time", `${formatInVenueTz(b.start, brand.timezone)} – ${formatInVenueTz(b.end, brand.timezone, "h:mm a")}`],
    ["Event", b.eventType],
    ["Guests", String(b.guestCount)],
    ["Total", formatMoney(b.totalCents, brand.currency)],
  ];
  if (b.securityDepositCents > 0)
    rows.push(["Refundable security deposit", formatMoney(b.securityDepositCents, brand.currency)]);
  if (b.balanceDueDate)
    rows.push(["Balance due by", formatInVenueTz(b.balanceDueDate, brand.timezone, "EEE, MMM d yyyy")]);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;margin:16px 0">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#71717a;width:45%">${esc(k)}</td><td style="padding:6px 0;font-weight:600">${esc(v)}</td></tr>`
    )
    .join("")}</table>`;
}

// --- Lifecycle templates ----------------------------------------------------

export function inquiryAckEmail(brand: VenueBrand, b: BookingSummary) {
  return {
    subject: `We received your inquiry — ${brand.name}`,
    html: layout(
      brand,
      `<h2 style="margin:0 0 12px">Thanks, ${esc(b.clientName)}!</h2>
       <p>We've received your inquiry for <strong>${esc(b.spaceName)}</strong> and will get back to you shortly with availability and a quote.</p>
       ${bookingTable(brand, b)}`
    ),
  };
}

export function quoteEmail(brand: VenueBrand, b: BookingSummary, quoteUrl: string, validUntil: Date) {
  return {
    subject: `Your quote from ${brand.name}`,
    html: layout(
      brand,
      `<h2 style="margin:0 0 12px">Your quote is ready</h2>
       <p>Hi ${esc(b.clientName)}, here's your quote for <strong>${esc(b.spaceName)}</strong>. It's valid until <strong>${formatInVenueTz(validUntil, brand.timezone, "MMM d, yyyy")}</strong>.</p>
       ${bookingTable(brand, b)}
       <p>A deposit of <strong>${formatMoney(b.depositCents, brand.currency)}</strong> secures your date.</p>
       ${button(brand, quoteUrl, "View quote — Accept & pay deposit")}`
    ),
  };
}

export function depositReceiptEmail(brand: VenueBrand, b: BookingSummary, paidCents: number) {
  return {
    subject: `Deposit received — your booking is confirmed! ✨`,
    html: layout(
      brand,
      `<h2 style="margin:0 0 12px">You're booked!</h2>
       <p>We've received your deposit of <strong>${formatMoney(paidCents, brand.currency)}</strong>. Your event at <strong>${esc(b.spaceName)}</strong> is confirmed.</p>
       ${bookingTable(brand, b)}
       ${button(brand, b.manageUrl, "View or manage your booking")}`
    ),
  };
}

export function balanceReminderEmail(brand: VenueBrand, b: BookingSummary, dueCents: number, payUrl: string) {
  return {
    subject: `Balance reminder — ${esc(b.spaceName)} on ${formatInVenueTz(b.start, brand.timezone, "MMM d")}`,
    html: layout(
      brand,
      `<h2 style="margin:0 0 12px">Your balance is coming due</h2>
       <p>Hi ${esc(b.clientName)}, a friendly reminder that <strong>${formatMoney(dueCents, brand.currency)}</strong> is due${b.balanceDueDate ? ` by <strong>${formatInVenueTz(b.balanceDueDate, brand.timezone, "MMM d, yyyy")}</strong>` : ""} for your upcoming event.</p>
       ${bookingTable(brand, b)}
       ${button(brand, payUrl, "Pay balance now")}`
    ),
  };
}

export function eventWeekEmail(brand: VenueBrand, b: BookingSummary, logisticsHtml: string) {
  return {
    subject: `Your event this week at ${brand.name} — what to know`,
    html: layout(
      brand,
      `<h2 style="margin:0 0 12px">See you soon, ${esc(b.clientName)}!</h2>
       ${bookingTable(brand, b)}
       <div style="background:#fafafa;border-radius:8px;padding:16px">${logisticsHtml}</div>
       ${button(brand, b.manageUrl, "View booking details")}`
    ),
  };
}

export function thankYouEmail(brand: VenueBrand, b: BookingSummary, securityNoticeHtml: string) {
  return {
    subject: `Thank you from ${brand.name}!`,
    html: layout(
      brand,
      `<h2 style="margin:0 0 12px">Thank you, ${esc(b.clientName)}!</h2>
       <p>It was a pleasure hosting your event. We hope everything was perfect.</p>
       ${securityNoticeHtml}`
    ),
  };
}

export function securityRefundEmail(brand: VenueBrand, b: BookingSummary, refundCents: number, deductions: { reason: string; amountCents: number }[]) {
  const items = deductions.length
    ? `<p>Deductions:</p><ul>${deductions.map((d) => `<li>${esc(d.reason)} — ${formatMoney(d.amountCents, brand.currency)}</li>`).join("")}</ul>`
    : "<p>No deductions were made.</p>";
  return {
    subject: `Your security deposit refund — ${brand.name}`,
    html: layout(
      brand,
      `<h2 style="margin:0 0 12px">Security deposit refund</h2>
       <p>We've processed your security deposit refund of <strong>${formatMoney(refundCents, brand.currency)}</strong>.</p>
       ${items}
       <p>Funds typically arrive within 5–10 business days.</p>`
    ),
  };
}

export function cancellationEmail(brand: VenueBrand, b: BookingSummary, refundCents: number, refundPct: number) {
  return {
    subject: `Booking cancelled — ${brand.name}`,
    html: layout(
      brand,
      `<h2 style="margin:0 0 12px">Your booking has been cancelled</h2>
       ${bookingTable(brand, b)}
       <p>Per the cancellation policy (${refundPct}% refund tier), a refund of <strong>${formatMoney(refundCents, brand.currency)}</strong> ${refundCents > 0 ? "has been issued and will arrive within 5–10 business days" : "is not due"}.</p>`
    ),
  };
}

export function paymentFailedEmail(brand: VenueBrand, b: BookingSummary, retryUrl: string) {
  return {
    subject: `Payment failed — action needed`,
    html: layout(
      brand,
      `<h2 style="margin:0 0 12px">We couldn't process your payment</h2>
       <p>Hi ${esc(b.clientName)}, your recent payment for <strong>${esc(b.spaceName)}</strong> didn't go through. Please try again.</p>
       ${button(brand, retryUrl, "Retry payment")}`
    ),
  };
}

export function tourRequestOwnerEmail(brand: VenueBrand, t: { name: string; email: string; phone: string | null; requestedAt: Date; notes: string | null }, dashboardUrl: string) {
  return {
    subject: `New tour request — ${esc(t.name)}`,
    html: layout(
      brand,
      `<h2 style="margin:0 0 12px">New venue tour request</h2>
       <p><strong>${esc(t.name)}</strong> (${esc(t.email)}${t.phone ? `, ${esc(t.phone)}` : ""}) requested a 30-minute tour on <strong>${formatInVenueTz(t.requestedAt, brand.timezone)}</strong>.</p>
       ${t.notes ? `<p>Notes: ${esc(t.notes)}</p>` : ""}
       ${button(brand, dashboardUrl, "Confirm or decline")}`
    ),
  };
}

export function tourConfirmedEmail(brand: VenueBrand, t: { name: string; requestedAt: Date }) {
  return {
    subject: `Tour confirmed — ${brand.name}`,
    html: layout(
      brand,
      `<h2 style="margin:0 0 12px">Your tour is confirmed</h2>
       <p>Hi ${esc(t.name)}, we look forward to showing you around on <strong>${formatInVenueTz(t.requestedAt, brand.timezone)}</strong>.</p>`
    ),
  };
}
