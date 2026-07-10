"use client";

// Thin client wrapper around a FormData server action that returns
// { ok: false, error } on failure and redirects on success. Renders the
// error inline and disables the submit button while pending.

import * as React from "react";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/actions/auth";

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => action(formData),
    null
  );

  return (
    <form action={formAction} className={className}>
      {state && !state.ok && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {state.error}
        </p>
      )}
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

const PendingContext = React.createContext(false);

export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pending = React.useContext(PendingContext);
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
      }
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
