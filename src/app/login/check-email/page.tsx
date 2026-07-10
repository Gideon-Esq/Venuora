import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "Check your inbox" };

export default function CheckEmailPage() {
  return (
    <div className="public-page flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <MailCheck className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-zinc-900">Check your inbox</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          We&apos;ve sent you a sign-in link. Click it on this device to continue — the link
          expires after a short while.
        </p>
        <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
          Dev note: in local development the link is printed to the server console.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
