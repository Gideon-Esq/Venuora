"use client";

// "Accept & pay deposit" — acceptQuoteAction redirects to checkout on
// success or returns { ok: false, error } (expired / slot just taken).

import * as React from "react";
import { Loader2 } from "lucide-react";
import { acceptQuoteAction } from "@/actions/quote";

export function AcceptQuoteButton({
  token,
  brandColor,
  label,
}: {
  token: string;
  brandColor: string;
  label: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    try {
      const result = await acceptQuoteAction(token);
      // On success the action redirects and never returns.
      if (result && !result.ok) {
        setError(result.error);
        setPending(false);
      }
    } catch {
      setError("Something went wrong — please try again.");
      setPending(false);
    }
  }

  return (
    <div>
      {error && (
        <p
          role="alert"
          className="mx-auto mb-4 max-w-md rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      <button
        onClick={accept}
        disabled={pending}
        className="inline-flex h-13 min-h-12 items-center justify-center gap-2 rounded-xl px-8 text-base font-semibold text-white shadow-md transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
        style={{ backgroundColor: brandColor }}
      >
        {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
        {label}
      </button>
    </div>
  );
}
