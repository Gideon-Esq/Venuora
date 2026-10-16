import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn(), resendSend: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.createTransport } }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.resendSend }; } }));
const message = { to: "guest@example.com", subject: "Your booking", html: "<p>Hello</p>", text: "Hello", replyTo: "host@example.com" };
beforeEach(() => {
  vi.resetModules();
  for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM", "RESEND_API_KEY"]) vi.stubEnv(key, "");
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.sendMail.mockResolvedValue({ accepted: [message.to], rejected: [] });
  mocks.resendSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function configureSmtp() {
  vi.stubEnv("SMTP_HOST", "smtp.gmail.com"); vi.stubEnv("SMTP_USER", "owner@example.com");
  vi.stubEnv("SMTP_PASSWORD", "app-password"); vi.stubEnv("EMAIL_FROM", "Venuora <owner@example.com>");
}
describe("email delivery", () => {
  it("sends HTML, text and reply-to with Gmail SMTP using STARTTLS", async () => {
    configureSmtp();
    const { sendEmail } = await import("@/lib/email"); await sendEmail(message);
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp.gmail.com", port: 587, secure: false, requireTLS: true, auth: { user: "owner@example.com", pass: "app-password" }, disableFileAccess: true, disableUrlAccess: true }));
    expect(mocks.sendMail).toHaveBeenCalledWith({ ...message, from: "Venuora <owner@example.com>" });
  });
  it("uses implicit TLS on port 465 and reuses the transporter", async () => {
    configureSmtp(); vi.stubEnv("SMTP_PORT", "465");
    const { sendEmail } = await import("@/lib/email"); await sendEmail(message); await sendEmail(message);
    expect(mocks.createTransport).toHaveBeenCalledTimes(1);
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 465, secure: true, requireTLS: false }));
  });
  it("prioritizes SMTP over a configured Resend key", async () => {
    configureSmtp(); vi.stubEnv("RESEND_API_KEY", "re_test");
    const { sendEmail } = await import("@/lib/email"); await sendEmail(message);
    expect(mocks.sendMail).toHaveBeenCalledTimes(1); expect(mocks.resendSend).not.toHaveBeenCalled();
  });
  it("fails incomplete SMTP configuration rather than silently skipping email", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
    const { sendEmail } = await import("@/lib/email"); await expect(sendEmail(message)).rejects.toThrow("Configure SMTP_USER");
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
  it("propagates SMTP delivery failures without falling back", async () => {
    configureSmtp(); mocks.sendMail.mockRejectedValueOnce(new Error("SMTP unavailable"));
    const { sendEmail } = await import("@/lib/email"); await expect(sendEmail(message)).rejects.toThrow("SMTP unavailable");
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });
  it("treats rejected recipients as failures", async () => {
    configureSmtp(); mocks.sendMail.mockResolvedValueOnce({ accepted: [], rejected: [message.to] });
    const { sendEmail } = await import("@/lib/email"); await expect(sendEmail(message)).rejects.toThrow("rejected");
  });
  it("preserves Resend delivery when SMTP is absent", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const { sendEmail } = await import("@/lib/email"); await sendEmail(message);
    expect(mocks.resendSend).toHaveBeenCalledWith(expect.objectContaining({ ...message, from: "Venuora <onboarding@resend.dev>" }));
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
  it("keeps unconfigured local development in console mode", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_placeholder");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { sendEmail, emailTransport } = await import("@/lib/email"); await sendEmail(message);
    expect(emailTransport()).toBe("console"); expect(log).toHaveBeenCalled(); expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
