"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { toggleChecklistAction } from "@/actions/booking";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Field = "setupDone" | "eventDone";

/**
 * "What happens next" checklist. The balance item is derived (read-only);
 * setup / teardown are real checkboxes bound to Booking.setupDone/eventDone.
 */
export function NextSteps({
  slug,
  bookingId,
  balance,
  setupLabel,
  setupDone,
  eventDone,
}: {
  slug: string;
  bookingId: string;
  balance: { label: string; hint?: string; done: boolean } | null;
  setupLabel: string;
  setupDone: boolean;
  eventDone: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = React.useState({ setupDone, eventDone });
  const [pending, setPending] = React.useState<Field | null>(null);
  const baseId = React.useId();

  // Re-sync when the server sends fresh values (after router.refresh()).
  const [prev, setPrev] = React.useState({ setupDone, eventDone });
  if (prev.setupDone !== setupDone || prev.eventDone !== eventDone) {
    setPrev({ setupDone, eventDone });
    setState({ setupDone, eventDone });
  }

  const toggle = async (field: Field, label: string) => {
    const next = !state[field];
    setState((s) => ({ ...s, [field]: next })); // optimistic
    setPending(field);
    try {
      await toggleChecklistAction(slug, bookingId, field, next);
      toast(next ? `Done: ${label}` : `Reopened: ${label}`);
      router.refresh();
    } catch {
      setState((s) => ({ ...s, [field]: !next }));
      toast("Couldn't save that change — please try again.", "error");
    } finally {
      setPending(null);
    }
  };

  const rows: { field: Field; label: string; hint: string }[] = [
    { field: "setupDone", label: setupLabel, hint: "Setup buffer begins before the event" },
    { field: "eventDone", label: "Teardown done", hint: "Space cleared and handed back" },
  ];

  return (
    <ul className="space-y-3">
      {balance && (
        <li
          className={cn(
            "flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3",
            balance.done && "opacity-80"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border",
              balance.done ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"
            )}
          >
            {balance.done && <Check className="h-3 w-3" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block text-sm text-foreground", balance.done && "line-through decoration-muted-foreground")}>
              {balance.label}
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden />
              {balance.done ? "Paid in full" : (balance.hint ?? "Ticks itself once the balance is paid")}
            </span>
          </span>
          <span className="sr-only">{balance.done ? "(complete)" : "(not complete)"}</span>
        </li>
      )}
      {rows.map((r) => {
        const id = `${baseId}-${r.field}`;
        const checked = state[r.field];
        return (
          <li key={r.field}>
            <label
              htmlFor={id}
              className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 hover:bg-muted/60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={pending === r.field}
                onChange={() => toggle(r.field, r.label)}
                className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-primary"
                aria-describedby={`${id}-hint`}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm text-foreground", checked && "line-through decoration-muted-foreground")}>
                  {r.label}
                </span>
                <span id={`${id}-hint`} className="mt-0.5 block text-xs text-muted-foreground">
                  {r.hint}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
