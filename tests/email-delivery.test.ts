import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ resendSend: vi.fn() }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.resendSend }; } }));
const fetchMock = vi.fn();
const message = { to: "guest@example.com", subject: "Your booking — confirmed", html: "<p>Hello</p>", text: "Hello", replyTo: "host@example.com" };
beforeEach(() => {
  vi.resetModules();
  for (const key of ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "EMAIL_FROM", "RESEND_API_KEY"]) vi.stubEnv(key, "");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string) => url.includes("oauth2") ? Response.json({ access_token: "access-token", expires_in: 3600 }) : Response.json({ id: "mail-1" }));
  mocks.resendSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function configureGmail() {
  vi.stubEnv("GMAIL_CLIENT_ID", "client-id"); vi.stubEnv("GMAIL_CLIENT_SECRET", "client-secret");
  vi.stubEnv("GMAIL_REFRESH_TOKEN", "refresh-token"); vi.stubEnv("EMAIL_FROM", "Venuora <owner@example.com>");
}
describe("Gmail API delivery", () => {
  it("refreshes OAuth and sends encoded MIME with HTML, text, reply-to and a Unicode subject", async () => {
    configureGmail();
    const { sendEmail } = await import("@/lib/email"); await sendEmail(message);
    expect(fetchMock.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    expect(fetchMock.mock.calls[0][1].body.get("grant_type")).toBe("refresh_token");
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect(options.headers.Authorization).toBe("Bearer access-token");
    const { raw } = JSON.parse(options.body);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    const mime = Buffer.from(raw, "base64url").toString();
    expect(mime).toContain("To: guest@example.com"); expect(mime).toContain("Reply-To: host@example.com");
    expect(mime).toContain("multipart/alternative"); expect(mime).toContain("text/html"); expect(mime).toContain("text/plain");
    expect(mime).toContain("Hello"); expect(mime).not.toContain("client-secret");
  });
  it("reuses a valid access token", async () => {
    configureGmail(); const { sendEmail } = await import("@/lib/email"); await sendEmail(message); await sendEmail(message);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("oauth2"))).toHaveLength(1);
  });
  it("shares refresh requests across concurrent sends", async () => {
    configureGmail(); const { sendEmail } = await import("@/lib/email"); await Promise.all([sendEmail(message), sendEmail(message)]);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("oauth2"))).toHaveLength(1);
  });
  it("fails incomplete configuration without attempting delivery", async () => {
    vi.stubEnv("GMAIL_CLIENT_ID", "client-id"); const { sendEmail } = await import("@/lib/email");
    await expect(sendEmail(message)).rejects.toThrow("Configure GMAIL_CLIENT_ID"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not disclose OAuth errors or fall back to Resend", async () => {
    configureGmail(); vi.stubEnv("RESEND_API_KEY", "re_test"); fetchMock.mockResolvedValue(Response.json({ error: "secret details" }, { status: 400 }));
    const { sendEmail } = await import("@/lib/email"); await expect(sendEmail(message)).rejects.toThrow("Gmail authorization failed");
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });
  it("refreshes and retries once on a rejected access token", async () => {
    configureGmail(); fetchMock.mockResolvedValueOnce(Response.json({ access_token: "old", expires_in: 3600 })).mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(Response.json({ access_token: "new", expires_in: 3600 })).mockResolvedValueOnce(Response.json({ id: "sent" }));
    const { sendEmail } = await import("@/lib/email"); await sendEmail(message); expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe("Bearer new");
  });
  it("does not retry ambiguous sending failures", async () => {
    configureGmail(); fetchMock.mockResolvedValueOnce(Response.json({ access_token: "token", expires_in: 3600 })).mockResolvedValueOnce(new Response(null, { status: 500 }));
    const { sendEmail } = await import("@/lib/email"); await expect(sendEmail(message)).rejects.toThrow("Gmail API delivery failed (500)"); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("preserves Resend when Gmail is absent", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test"); const { sendEmail } = await import("@/lib/email"); await sendEmail(message);
    expect(mocks.resendSend).toHaveBeenCalledWith(expect.objectContaining(message)); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps unconfigured local development in console mode", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_placeholder"); const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { sendEmail, emailTransport } = await import("@/lib/email"); await sendEmail(message);
    expect(emailTransport()).toBe("console"); expect(log).toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
});
