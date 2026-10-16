// Venue-branded transactional emails. Every template carries the VENUE's
// name/logo/color — venue branding leads, with a small platform attribution in the footer.

import type { EventType } from "@/generated/prisma/enums";
import { contrastRatio, parseHex, textOnColor } from "./color";
import { EVENT_TYPE_LABELS } from "./labels";
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
  // Optional address fields (header location line + tour confirmation).
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
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
  /** Setup buffer in minutes; when present, receipts show the setup access time. */
  setupBufferMins?: number | null;
}

// --- Shared building blocks -------------------------------------------------
// Email-safe HTML only: nested tables + inline styles, no external CSS, and
// everything still reads correctly with images blocked.

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const C = {
  canvas: "#f9f7f0",
  card: "#fdfcf7",
  border: "#e7e3d9",
  muted: "#f5f1e8",
  text: "#1b1a22",
  sub: "#5c5a66",
  faint: "#6f6c79",
};
const FONT =
  "Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FALLBACK_BRAND = "#5145ae";

/** Venue colour, validated so it can be inlined safely into style attributes. */
function brandHex(brand: VenueBrand): string {
  return parseHex(brand.brandColor) ? `#${brand.brandColor.trim().replace(/^#/, "")}` : FALLBACK_BRAND;
}

/**
 * Brand colour usable as TEXT on the card background (AA 4.5:1). Light brand
 * colours are darkened step by step; if nothing passes, use the foreground.
 */
function brandTextHex(brand: VenueBrand): string {
  const base = parseHex(brandHex(brand));
  if (!base) return C.text;
  for (let f = 1; f >= 0.3; f -= 0.05) {
    const hex = `#${base
      .map((c) => Math.round(c * f).toString(16).padStart(2, "0"))
      .join("")}`;
    if (contrastRatio(hex, C.card) >= 4.5) return hex;
  }
  return C.text;
}

/** "church program" / "CHURCH_PROGRAM" → "Church program" (falls back to title-case). */
export function eventTypeLabel(raw: string): string {
  const norm = raw.trim().replaceAll("_", " ").toLowerCase();
  const hit = (Object.keys(EVENT_TYPE_LABELS) as EventType[]).find(
    (k) => k.replaceAll("_", " ").toLowerCase() === norm
  );
  if (hit) return EVENT_TYPE_LABELS[hit];
  return norm ? norm.charAt(0).toUpperCase() + norm.slice(1) : raw;
}

function venueLocation(brand: VenueBrand): string {
  return [brand.city, brand.region].filter(Boolean).join(", ");
}

function venueContact(brand: VenueBrand): string {
  return [brand.phone, brand.email].filter(Boolean).join(" · ");
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const fmtDate = (brand: VenueBrand, d: Date, pattern = "EEE, MMM d, yyyy") =>
  formatInVenueTz(d, brand.timezone, pattern);

/** Small label above the headline, in the venue colour (contrast-checked). */
export function eyebrow(text: string, brand?: VenueBrand): string {
  const color = brand ? brandTextHex(brand) : C.sub;
  return `<p style="margin:0 0 8px;font-size:14px;line-height:20px;font-weight:500;color:${color}">${esc(text)}</p>`;
}

/** H1-sized headline. */
export function headline(text: string): string {
  return `<h1 style="margin:0 0 20px;font-size:26px;line-height:32px;font-weight:600;letter-spacing:-0.01em;color:${C.text}">${esc(text)}</h1>`;
}

/** Intro / body paragraph (accepts trusted, already-escaped HTML). */
export function para(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.sub}">${html}</p>`;
}

/** "Hi Lena," greeting line. */
function greeting(name: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:24px;color:${C.sub}">Hi ${esc(firstName(name))},</p>`;
}

/** Tinted rounded box for details (accepts trusted HTML). */
export function detailsBox(innerHtml: string, title?: string): string {
  const heading = title
    ? `<p style="margin:0 0 12px;font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${C.sub}">${esc(title)}</p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0;border-collapse:separate">
    <tr><td style="background:${C.muted};border:1px solid ${C.border};border-radius:12px;padding:18px 20px">${heading}${innerHtml}</td></tr>
  </table>`;
}

/** Label (small, muted) stacked over value — rows inside the summary box. */
function stackedRows(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:0 0 12px">
          <p style="margin:0;font-size:12px;line-height:16px;color:${C.sub}">${esc(k)}</p>
          <p style="margin:2px 0 0;font-size:15px;line-height:22px;font-weight:500;color:${C.text}">${esc(v)}</p>
        </td></tr>`
    )
    .join("")}</table>`;
}

/** Ruled list of amounts: label left, bold value right. */
function moneyRows(rows: [string, string][]): string {
  if (!rows.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 8px;border-top:1px solid ${C.border};font-size:14px;line-height:20px">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:14px 12px 14px 0;border-bottom:1px solid ${C.border};color:${C.sub}">${esc(k)}</td><td align="right" style="padding:14px 0;border-bottom:1px solid ${C.border};font-weight:600;color:${C.text};text-align:right;white-space:nowrap">${esc(v)}</td></tr>`
    )
    .join("")}</table>`;
}

export function layout(brand: VenueBrand, bodyHtml: string, centered = false): string {
  const location = venueLocation(brand);
  const contact = venueContact(brand);
  const nameBlock = `<p style="margin:0;font-size:17px;line-height:24px;font-weight:600;color:${C.text}">${esc(brand.name)}</p>
        ${location ? `<p style="margin:2px 0 0;font-size:13px;line-height:18px;color:${C.sub}">${esc(location)}</p>` : ""}`;
  const header = brand.logoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" style="padding-right:12px"><img src="${esc(brand.logoUrl)}" alt="" width="32" height="32" style="display:block;width:32px;height:32px;border:0;border-radius:6px" /></td>
        <td valign="middle">${nameBlock}</td>
      </tr></table>`
    : nameBlock;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light only" /><title>${esc(brand.name)}</title></head>
<body style="margin:0;padding:0;background:${C.canvas};font-family:${FONT};color:${C.text};-webkit-text-size-adjust:100%">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas}"><tr><td align="center" style="padding:32px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.card};border:1px solid ${C.border};border-radius:12px;border-collapse:separate">
      <tr><td style="padding:28px 28px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%"><tr>
          <td style="padding:0 0 24px;border-bottom:1px solid ${C.border}">${centered ? `<div style="text-align:center"><table role="presentation" align="center" style="margin:0 auto 12px"><tr><td style="background:${brandHex(brand)};color:${textOnColor(brandHex(brand))};border-radius:50%;width:48px;height:48px;text-align:center;font-size:20px;font-weight:600">${esc(brand.name.slice(0,1))}</td></tr></table>${nameBlock}</div>` : header}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 28px 8px;font-size:15px;line-height:24px;color:${C.sub}">
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:0 28px 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%"><tr>
          <td style="padding:20px 0 0;border-top:1px solid ${C.border};font-size:12px;line-height:18px;color:${C.faint}">
            <p style="margin:0">Questions about your booking? Reply to this email or contact ${esc(brand.name)}.${contact ? ` ${esc(contact)}` : ""}</p>
            <p style="margin:10px 0 0">Powered by Venuora</p>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/** Brand-coloured CTA plus the plain-URL fallback line. */
export function button(brand: VenueBrand, href: string, label: string): string {
  const color = brandHex(brand);
  const link = brandTextHex(brand);
  const safe = esc(href);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0 16px"><tr>
    <td align="center" style="border-radius:8px;background:${color}">
      <a href="${safe}" style="display:block;padding:12px 20px;border-radius:8px;background:${color};color:${textOnColor(color)};font-size:15px;line-height:20px;font-weight:600;text-decoration:none">${esc(label)}</a>
    </td>
  </tr></table>
  <p style="margin:0 0 24px;font-size:12px;line-height:18px;color:${C.faint}">If the button above does not work, copy and paste this link into your browser:<br /><a href="${safe}" style="color:${link};word-break:break-all">${safe}</a></p>`;
}

function rowsTable(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:20px">${rows
    .map(
      ([k, v]) =>
        `<tr><td valign="top" style="padding:5px 12px 5px 0;color:${C.sub};width:42%">${esc(k)}</td><td valign="top" style="padding:5px 0;font-weight:600;color:${C.text}">${esc(v)}</td></tr>`
    )
    .join("")}</table>`;
}

/** Core event rows: space, date & time, event type, guests. */
function eventRows(brand: VenueBrand, b: BookingSummary): [string, string][] {
  return [
    ["Space", b.spaceName],
    ["Date & time", `${formatInVenueTz(b.start, brand.timezone)} – ${formatInVenueTz(b.end, brand.timezone, "h:mm a")}`],
    ["Event type", eventTypeLabel(b.eventType)],
    ["Guests", String(b.guestCount)],
  ];
}

function summaryBox(brand: VenueBrand, b: BookingSummary, title: string, extra: [string, string][] = []): string {
  return detailsBox(stackedRows([...eventRows(brand, b), ...extra]), title);
}

const securityRow = (brand: VenueBrand, b: BookingSummary): [string, string][] =>
  b.securityDepositCents > 0
    ? [["Refundable security deposit", formatMoney(b.securityDepositCents, brand.currency)]]
    : [];

/** Summary box with the booking's event details (kept for compatibility). */
export function bookingTable(brand: VenueBrand, b: BookingSummary): string {
  return summaryBox(brand, b, "Booking details", securityRow(brand, b));
}

// --- Lifecycle templates ----------------------------------------------------

const strong = (s: string) => `<strong style="color:${C.text};font-weight:600">${s}</strong>`;

export function inquiryAckEmail(brand: VenueBrand, b: BookingSummary) {
  return {
    subject: `We received your inquiry — ${brand.name}`,
    html: layout(
      brand,
      `${eyebrow("Request received", brand)}
       ${headline("We received your booking request")}
       ${greeting(b.clientName)}
       ${para(`Thanks for your interest in ${strong(esc(b.spaceName))}. We've received your inquiry and will get back to you shortly with availability and a quote.`)}
       ${summaryBox(brand, b, "Event summary")}
       ${b.totalCents > 0 ? moneyRows([["Estimated total", formatMoney(b.totalCents, brand.currency)]]) : ""}
       ${detailsBox(para("No payment has been taken. Your date is not confirmed until the venue confirms your booking."))}`
    ),
  };
}

export function quoteEmail(brand: VenueBrand, b: BookingSummary, quoteUrl: string, validUntil: Date) {
  const balance = Math.max(0, b.totalCents - b.depositCents);
  const money: [string, string][] = [
    ["Total", formatMoney(b.totalCents, brand.currency)],
    ["Deposit due", formatMoney(b.depositCents, brand.currency)],
  ];
  if (balance > 0)
    money.push([
      b.balanceDueDate ? `Balance due ${fmtDate(brand, b.balanceDueDate, "MMM d")}` : "Balance",
      formatMoney(balance, brand.currency),
    ]);
  return {
    subject: `Your quote from ${brand.name}`,
    html: layout(
      brand,
      `${eyebrow("Your quote is ready", brand)}
       ${headline(`Your ${brand.name} quote is ready`)}
       ${greeting(b.clientName)}
       ${para(`Your ${esc(brand.name)} quote is ready to review. Here is a summary of your event and the amounts associated with it.`)}
       ${summaryBox(brand, b, "Event summary", [
         ["Quote valid through", fmtDate(brand, validUntil)],
         ...securityRow(brand, b),
       ])}
       ${moneyRows(money)}
       ${button(brand, quoteUrl, "Review quote")}`
    ),
  };
}

export function depositReceiptEmail(brand: VenueBrand, b: BookingSummary, paidCents: number) {
  const extra: [string, string][] = [];
  if (b.setupBufferMins && b.setupBufferMins > 0)
    extra.push([
      "Setup access",
      formatInVenueTz(new Date(b.start.getTime() - b.setupBufferMins * 60_000), brand.timezone, "h:mm a"),
    ]);
  const remaining = Math.max(0, b.totalCents - paidCents);
  const money: [string, string][] = [
    ["Amount paid", formatMoney(paidCents, brand.currency)],
    ["Remaining balance", formatMoney(remaining, brand.currency)],
  ];
  if (remaining > 0 && b.balanceDueDate) money.push(["Balance due", fmtDate(brand, b.balanceDueDate, "MMM d, yyyy")]);
  return {
    subject: `Deposit received — your booking is confirmed! ✨`,
    html: layout(
      brand,
      `${eyebrow("Booking confirmed", brand)}
       ${headline(`Your ${brand.name} booking is confirmed`)}
       ${greeting(b.clientName)}
       ${para("Your deposit has been received and your booking is confirmed. We look forward to welcoming you.")}
       ${summaryBox(brand, b, "Booking details", extra)}
       ${moneyRows(money)}
       ${button(brand, b.manageUrl, "View booking")}`
    ),
  };
}

export function balanceReminderEmail(brand: VenueBrand, b: BookingSummary, dueCents: number, payUrl: string) {
  const money: [string, string][] = [["Amount due", formatMoney(dueCents, brand.currency)]];
  if (b.balanceDueDate) money.push(["Due date", fmtDate(brand, b.balanceDueDate)]);
  return {
    subject: `Balance reminder — ${esc(b.spaceName)} on ${formatInVenueTz(b.start, brand.timezone, "MMM d")}`,
    html: layout(
      brand,
      `${eyebrow("Balance reminder", brand)}
       ${headline(`Your ${brand.name} balance is coming due`)}
       ${greeting(b.clientName)}
       ${para("A friendly reminder that the remaining balance for your upcoming event is coming due. Pay securely to keep your event on track.")}
       ${b.securityDepositCents > 0 ? para("Your refundable security deposit is separate from the venue rental balance.") : ""}
       ${summaryBox(brand, b, "Booking details")}
       ${moneyRows(money)}
       ${button(brand, payUrl, "Pay balance")}`
    ),
  };
}

export function eventWeekEmail(brand: VenueBrand, b: BookingSummary, logisticsHtml: string) {
  return {
    subject: `Your event this week at ${brand.name} — what to know`,
    html: layout(
      brand,
      `${eyebrow("Event week", brand)}
       ${headline(`Your ${brand.name} event is almost here`)}
       ${greeting(b.clientName)}
       ${para("Here is what you need to know before arriving for your event.")}
       ${summaryBox(brand, b, "Booking details")}
       <div style="margin:0 0 8px;padding:16px 20px;border:1px solid ${C.border};border-radius:12px;font-size:14px;line-height:22px;color:${C.sub}">${logisticsHtml}</div>
       ${button(brand, b.manageUrl, "View booking")}`
    ),
  };
}

export function thankYouEmail(brand: VenueBrand, b: BookingSummary, securityNoticeHtml: string) {
  return {
    subject: `Thank you from ${brand.name}!`,
    html: layout(
      brand,
      `${eyebrow("Thank you", brand)}
       ${headline(`Thank you for celebrating at ${brand.name}`)}
       ${greeting(b.clientName)}
       ${para("It was a pleasure hosting your event. We hope everything was perfect.")}
       <div style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.sub}">${securityNoticeHtml}</div>`
    ),
  };
}

export function securityRefundEmail(brand: VenueBrand, b: BookingSummary, refundCents: number, deductions: { reason: string; amountCents: number }[]) {
  const items = deductions.length
    ? detailsBox(rowsTable(deductions.map((d) => [d.reason, formatMoney(d.amountCents, brand.currency)])), "Deductions")
    : para("No deductions were made.");
  return {
    subject: `Your security deposit refund — ${brand.name}`,
    html: layout(
      brand,
      `${eyebrow("Deposit refund", brand)}
       ${headline(`Your ${brand.name} security deposit refund`)}
       ${greeting(b.clientName)}
       ${para("We've processed the refund of your security deposit.")}
       ${items}
       ${moneyRows([["Refund", formatMoney(refundCents, brand.currency)]])}
       ${para("Funds typically arrive within 5–10 business days.")}`
    ),
  };
}

export function cancellationEmail(brand: VenueBrand, b: BookingSummary, refundCents: number, refundPct: number) {
  return {
    subject: `Booking cancelled — ${brand.name}`,
    html: layout(
      brand,
      `${eyebrow("Booking cancelled", brand)}
       ${headline(`Your ${brand.name} booking has been cancelled`)}
       ${greeting(b.clientName)}
       ${para(`Your booking has been cancelled. Per the cancellation policy (${refundPct}% refund tier), ${refundCents > 0 ? "your refund has been issued and will arrive within 5–10 business days" : "no refund is due"}.`)}
       ${summaryBox(brand, b, "Booking details")}
       ${moneyRows([["Refund", formatMoney(refundCents, brand.currency)]])}`
    ),
  };
}

export function paymentFailedEmail(brand: VenueBrand, b: BookingSummary, retryUrl: string) {
  return {
    subject: `Payment failed — action needed`,
    html: layout(
      brand,
      `${eyebrow("Payment issue", brand)}
       ${headline(`Your ${brand.name} payment didn't go through`)}
       ${greeting(b.clientName)}
       ${para(`Your recent payment for ${strong(esc(b.spaceName))} could not be processed. Please try again using the button below.`)}
       ${button(brand, retryUrl, "Retry payment")}`
    ),
  };
}

export function tourRequestOwnerEmail(brand: VenueBrand, t: { name: string; email: string; phone: string | null; requestedAt: Date; notes: string | null }, dashboardUrl: string) {
  const rows: [string, string][] = [
    ["Name", t.name],
    ["Email", t.email],
    ...(t.phone ? [["Phone", t.phone] as [string, string]] : []),
    ["Requested time", formatInVenueTz(t.requestedAt, brand.timezone)],
    ["Duration", "30 minutes"],
    ...(t.notes ? [["Notes", t.notes] as [string, string]] : []),
  ];
  return {
    subject: `New tour request — ${esc(t.name)}`,
    html: layout(
      brand,
      `${eyebrow("Tour request", brand)}
       ${headline("New venue tour request")}
       ${para(`${strong(esc(t.name))} requested a 30-minute tour on ${strong(formatInVenueTz(t.requestedAt, brand.timezone))}.`)}
       ${detailsBox(stackedRows(rows), "Request details")}
       ${button(brand, dashboardUrl, "Confirm or decline")}`
    ),
  };
}

export function tourConfirmedEmail(brand: VenueBrand, t: { name: string; requestedAt: Date }) {
  const address = [
    brand.addressLine1,
    brand.addressLine2,
    [[brand.city, brand.region].filter(Boolean).join(", "), brand.postalCode].filter(Boolean).join(" "),
  ]
    .filter((l): l is string => !!l && l.trim().length > 0)
    .join(", ");
  const rows: [string, string][] = [
    ["Date & time", formatInVenueTz(t.requestedAt, brand.timezone)],
    ["Timezone", brand.timezone],
    ["Duration", "30-minute venue tour"],
  ];
  if (address) rows.push(["Address", address]);
  return {
    subject: `Tour confirmed — ${brand.name}`,
    html: layout(
      brand,
      `${eyebrow("Tour confirmed", brand)}
       ${headline("Your tour is confirmed")}
       ${greeting(t.name)}
       ${para(`We look forward to showing you around ${esc(brand.name)}. If you need to make a change, please contact the venue directly.`)}
       ${detailsBox(stackedRows([...rows, ...(venueContact(brand) ? [["Questions?", venueContact(brand)] as [string,string]] : [])]), "Confirmed appointment")}
       ${brand.email ? button(brand, `mailto:${brand.email}`, "Contact venue") : ""}
       ${para("Your appointment is confirmed. If you need to make a change, please contact the venue directly.")}`,
      true
    ),
  };
}

// --- Platform (Venuora-branded) emails -------------------------------------

const VENUORA = "#5145ae";

/** Magic-link sign-in email — Venuora infrastructure branding, not a venue's. */
export function magicLinkEmail(url: string) {
  const safeUrl = esc(url);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light only" /><title>Sign in to Venuora</title></head>
<body style="margin:0;padding:0;background:${C.canvas};font-family:${FONT};color:${C.text};-webkit-text-size-adjust:100%">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas}"><tr><td align="center" style="padding:32px 12px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:${C.card};border:1px solid ${C.border};border-radius:12px;border-collapse:separate">
      <tr><td align="center" style="padding:32px 24px 24px;background:#eeedfb;border-bottom:1px solid ${C.border};border-radius:12px 12px 0 0">
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr>
          <td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;border-radius:10px;background:${VENUORA};color:#ffffff;font-size:20px;line-height:48px;font-weight:600;font-family:${FONT}">V</td>
        </tr></table>
        <p style="margin:12px 0 0;font-size:18px;line-height:24px;font-weight:600;color:${C.text}">Venuora</p>
        <p style="margin:4px 0 0;font-size:13px;line-height:18px;color:${C.sub}">Secure booking management</p>
      </td></tr>
      <tr><td style="padding:32px 32px 28px;font-size:15px;line-height:24px;color:${C.sub}">
        <p style="margin:0 0 8px;font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${VENUORA}">Secure access</p>
        ${headline("Sign in to Venuora")}
        ${para("Use the secure link below to sign in to your Venuora account.")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border-collapse:separate">
          <tr><td style="background:#eeedfb;border:1px solid #d9d6f3;border-radius:10px;padding:14px 18px">
            <p style="margin:0;font-size:14px;line-height:20px;font-weight:600;color:${C.text}">One-time sign-in link</p>
            <p style="margin:4px 0 0;font-size:14px;line-height:20px;color:${C.sub}">This link can only be used once and is tied to your email address.</p>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 20px"><tr>
          <td align="center" style="border-radius:8px;background:${VENUORA}">
            <a href="${safeUrl}" style="display:block;padding:13px 24px;border-radius:8px;background:${VENUORA};color:#ffffff;font-size:15px;line-height:20px;font-weight:600;text-decoration:none;text-align:center">Sign in securely</a>
          </td>
        </tr></table>
        <p style="margin:0 0 8px;font-size:14px;line-height:22px;color:${C.sub}">This link expires in 24 hours.</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:${C.sub}">If you did not request this email, you can safely ignore it. Never share your sign-in link with anyone.</p>
        <p style="margin:0;font-size:12px;line-height:18px;color:${C.faint}">Button not working? Paste this link into your browser:<br /><a href="${safeUrl}" style="color:${VENUORA};word-break:break-all">${safeUrl}</a></p>
      </td></tr>
      <tr><td align="center" style="padding:18px 24px 22px;border-top:1px solid ${C.border};font-size:12px;line-height:18px;color:${C.faint}">
        Venuora helps venues manage bookings securely.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  const text = `Sign in to Venuora\n\nUse this one-time link to sign in:\n${url}\n\nThis link expires in 24 hours. If you did not request this email, you can safely ignore it.\n`;
  return { subject: "Sign in to Venuora", html, text };
}
