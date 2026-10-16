import nodemailer from "nodemailer";
import { Resend } from "resend";

let resend: Resend | null = null;
let access: { token: string; expires: number } | null = null;
let refreshing: Promise<string> | null = null;
const gmailKeys = ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"] as const;

export function emailTransport(): "gmail" | "resend" | "console" {
  if (gmailKeys.some(key => process.env[key]?.trim())) return "gmail";
  const key = process.env.RESEND_API_KEY?.trim();
  return key && !key.includes("placeholder") ? "resend" : "console";
}

async function gmailAccessToken(): Promise<string> {
  if (access && access.expires > Date.now() + 60_000) return access.token;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    if (gmailKeys.some(key => !process.env[key]?.trim()) || !process.env.EMAIL_FROM?.trim()) {
      throw new Error("Configure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN and EMAIL_FROM for Gmail API delivery.");
    }
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: process.env.GMAIL_CLIENT_ID!, client_secret: process.env.GMAIL_CLIENT_SECRET!, refresh_token: process.env.GMAIL_REFRESH_TOKEN!, grant_type: "refresh_token" }),
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Gmail authorization failed. Check the OAuth credentials and sender consent.");
    const data = await response.json();
    if (typeof data.access_token !== "string" || !data.access_token || typeof data.expires_in !== "number" || data.expires_in <= 0) throw new Error("Gmail returned an invalid authorization response.");
    access = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
    return access.token;
  })();
  try { return await refreshing; } finally { refreshing = null; }
}

export async function sendEmail(args: {
  to: string; subject: string; html: string; text?: string; replyTo?: string;
}): Promise<void> {
  const transport = emailTransport();
  if (transport === "console") {
    console.log(`\n📧 [email:dev] To: ${args.to}\nSubject: ${args.subject}\n`);
    return;
  }
  if (transport === "gmail") {
    let token = await gmailAccessToken();
    // Nodemailer composes MIME locally only. No SMTP connection is created.
    const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "windows" });
    const message = await composer.sendMail({ ...args, from: process.env.EMAIL_FROM!.trim(), disableFileAccess: true, disableUrlAccess: true });
    if (!Buffer.isBuffer(message.message)) {
      throw new Error("Expected buffered email output from Nodemailer.");
    }
    const raw = message.message.toString("base64url");
    const send = () => fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }), cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    let response = await send();
    if (response.status === 401) {
      access = null; token = await gmailAccessToken(); response = await send();
    }
    if (!response.ok) throw new Error(`Gmail API delivery failed (${response.status}). Check sender permissions and sending limits.`);
    const result = await response.json();
    if (typeof result.id !== "string" || !result.id) throw new Error("Gmail did not confirm message acceptance.");
    return;
  }
  resend ??= new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({ from: process.env.EMAIL_FROM?.trim() || "Venuora <onboarding@resend.dev>", ...args });
  if (result.error) throw new Error(`Email delivery failed: ${result.error.message}`);
}
