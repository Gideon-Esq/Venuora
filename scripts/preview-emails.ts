import { mkdirSync, writeFileSync } from "node:fs";
import { quoteEmail, depositReceiptEmail, balanceReminderEmail, eventWeekEmail, cancellationEmail, tourConfirmedEmail, type VenueBrand, type BookingSummary } from "../src/lib/email-templates";
// Representative preview data only. No emails are sent by this script.
const brand: VenueBrand = { name: "Harborlight Studio", logoUrl: null, brandColor: "#5145ae", email: "hello@example.com", phone: "(212) 555-0184", timezone: "America/New_York", currency: "USD", city: "New York", region: "NY" };
const booking: BookingSummary = { clientName: "Lena Ortiz", spaceName: "The Studio", eventType: "WEDDING", start: new Date("2026-11-18T22:00:00Z"), end: new Date("2026-11-19T03:00:00Z"), guestCount: 80, totalCents: 214700, depositCents: 107400, securityDepositCents: 50000, balanceDueDate: new Date("2026-11-04T17:00:00Z"), setupBufferMins: 120, manageUrl: "https://example.com/b/preview" };
const previews = [
  ["quote-ready", quoteEmail(brand, booking, "https://example.com/q/preview", new Date("2026-10-30T17:00:00Z"))],
  ["deposit-confirmation", depositReceiptEmail(brand, booking, 107400)],
  ["balance-reminder", balanceReminderEmail(brand, booking, 107300, "https://example.com/b/preview")],
  ["event-week", eventWeekEmail(brand, booking, "<p>Setup access begins at 3:00 PM. Please contact the venue before arranging vendor deliveries.</p>")],
  ["cancellation-refund", cancellationEmail(brand, booking, 107400, 100)],
  ["tour-confirmation", tourConfirmedEmail(brand, { name: booking.clientName, requestedAt: new Date("2026-11-01T19:30:00Z") })],
] as const;
mkdirSync("docs/email-previews", { recursive: true });
for (const [name, email] of previews) writeFileSync(`docs/email-previews/${name}.html`, email.html);
writeFileSync("docs/email-previews/index.html", `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Venuora email previews</title><body style="font:16px Arial;background:#f9f7f0;color:#1b1a22;max-width:700px;margin:48px auto;padding:24px"><h1>Venue email previews</h1><p>Sample data. These previews do not send email.</p>${previews.map(([name, email]) => `<p><a href="${name}.html">${email.subject}</a></p>`).join("")}</body></html>`);
console.log("Generated six email previews in docs/email-previews.");
