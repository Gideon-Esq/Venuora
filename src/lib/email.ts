import { Resend } from "resend";

const configured =
  !!process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes("placeholder");

let _resend: Resend | null = null;
function resend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  if (!configured) {
    console.log(`\n📧 [email:dev] To: ${args.to}\nSubject: ${args.subject}\n`);
    return;
  }
  await resend().emails.send({
    from: process.env.EMAIL_FROM ?? "Venuora <onboarding@resend.dev>",
    to: args.to,
    subject: args.subject,
    html: args.html,
    replyTo: args.replyTo,
  });
}
