import Link from "next/link";
import { MailWarning } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AuthShell } from "../auth-shell";
export default async function SignInError({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const {error} = await searchParams;
  const expired = error === "Verification";
  return <AuthShell><section className="rounded-xl border border-border bg-card p-6 text-center"><MailWarning className="mx-auto h-10 w-10 text-primary" aria-hidden /><h1 className="mt-5 text-2xl font-semibold">{expired ? "This sign-in link is no longer valid" : "We couldn’t sign you in"}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{expired ? "The link may have expired or already been used. Request a fresh link and open the most recent email." : "Please try signing in again. You can use your password or request an email sign-in link."}</p><Link href="/login" className={buttonVariants({className:"mt-6 w-full"})}>Request a new link</Link><Link href="/login" className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline">Back to sign in</Link></section></AuthShell>;
}
