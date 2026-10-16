import { describe, expect, it } from "vitest";
import { quoteEmail, depositReceiptEmail, type VenueBrand, type BookingSummary } from "../src/lib/email-templates";
const brand: VenueBrand = { name: "Venue <Test>", email: null, phone: null, logoUrl: null, brandColor: "#5145ae", timezone: "America/New_York", currency: "USD" };
const booking: BookingSummary = { clientName: "Lena <script>", spaceName: "Studio & Garden", eventType: "WEDDING", start: new Date("2026-11-18T22:00:00Z"), end: new Date("2026-11-19T03:00:00Z"), guestCount: 80, totalCents: 214700, depositCents: 107400, securityDepositCents: 50000, balanceDueDate: null, setupBufferMins: 120, manageUrl: "https://example.com/b/private" };
describe("transactional email rendering", () => {
  it("escapes record values and preserves the private quote link", () => {
    const { html } = quoteEmail(brand, booking, "https://example.com/q/private?a=1&b=2", new Date("2026-10-30T17:00:00Z"));
    expect(html).toContain("Venue &lt;Test&gt;");
    expect(html).toContain("Studio &amp; Garden");
    expect(html).not.toContain("<script>");
    expect(html).toContain("https://example.com/q/private?a=1&amp;b=2");
    expect(html).toContain("$2,147");
    expect(html).toContain("$1,074");
    expect(html).toContain("$1,073");
  });
  it("renders setup in venue time and calculates the remaining balance", () => {
    const { html } = depositReceiptEmail(brand, booking, 107400);
    expect(html).toContain("3:00 PM");
    expect(html).toContain("$1,073");
    expect(html).toContain(booking.manageUrl);
  });
});
