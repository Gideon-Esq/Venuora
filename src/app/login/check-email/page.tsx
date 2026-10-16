import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuthShell, textLink } from "../auth-shell";

export const metadata: Metadata = { title: "Check your inbox" };

const STEPS = [
  { title: "Open the email", body: "Find the sign-in email from Venuora." },
  { title: "Tap the secure link", body: "Use the link inside the email to sign in." },
  { title: "You’ll return to Venuora", body: "Your workspace will open automatically." },
];

export default async function CheckEmailPage({searchParams}: {searchParams: Promise<{email?:string}>}) {
  const {email} = await searchParams;
  return (
    <AuthShell>
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Mail className="h-9 w-9" aria-hidden />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">
          Check your inbox
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-pretty leading-7 text-muted-foreground">
          We sent a sign-in link{email ? ` to ${email.slice(0,254)}` : " to your email"}. Open it on this device to continue.
        </p>
      </div>

      <ol className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
            {i < STEPS.length - 1 && (
              <span aria-hidden className="absolute left-[13px] top-8 bottom-1 w-px bg-border" />
            )}
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            >
              {i + 1}
            </span>
            <div>
              <p className="font-medium text-foreground">{s.title}</p>
              <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-center text-sm leading-6 text-muted-foreground">
        It can take a minute. Check spam or promotions if you don&apos;t see it.
      </p>

      <div className="mt-8 flex flex-col items-center gap-4">
        <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          Back to sign in
        </Link>
        <Link href="/login" className={cn(textLink, "text-sm")}>
          Use a different email
        </Link>
      </div>

      <div className="mt-10 rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
          Link expired?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Return to sign in and request a new sign-in link.
        </p>
        <Link href="/login" className={cn(textLink, "mt-3 inline-block text-sm")}>
          Return to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
