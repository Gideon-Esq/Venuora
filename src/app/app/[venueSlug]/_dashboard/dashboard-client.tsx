"use client";

// Interactive bits of the "This week" dashboard: checklist switches, the
// payment-link controls (with inline retry), today's tour confirm button and
// the pending-tours list + drawer.
import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, CircleCheck, Copy, ExternalLink, LockKeyhole } from "lucide-react";
import { sendBalanceLinkAction, toggleChecklistAction } from "@/actions/booking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { TourDrawer, useTourStatus } from "../tours/tour-drawer";
import type { TourView } from "../tours/tour-shared";

/** Setup and teardown controls, with read-only status for the staff dashboard. */
export function ChecklistSwitch({
  slug,
  bookingId,
  field,
  done,
  label,
  shortLabel,
  hint,
  readOnly = false,
  compact = false,
}: {
  slug: string;
  bookingId: string;
  field: "setupDone" | "eventDone";
  done: boolean;
  label: string;
  shortLabel: string;
  hint: string;
  readOnly?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const id = React.useId();
  const [optimistic, setOptimistic] = React.useState<boolean | null>(null);
  const [prevDone, setPrevDone] = React.useState(done);
  const [pending, startTransition] = React.useTransition();
  // Server value changed (after refresh) → drop the optimistic override.
  if (prevDone !== done) {
    setPrevDone(done);
    setOptimistic(null);
  }
  const value = optimistic ?? done;

  const toggle = () => {
    const next = !value;
    setOptimistic(next);
    startTransition(async () => {
      try {
        await toggleChecklistAction(slug, bookingId, field, next);
        toast(next ? `${label} — saved.` : `${label} unmarked.`);
        router.refresh();
      } catch {
        setOptimistic(null);
        toast(`Couldn't update “${label.toLowerCase()}”. Please try again.`, "error");
      }
    });
  };

  const status = pending ? "Saving…" : value ? "Done" : "Not yet";

  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 transition-colors",
        !compact && "border-b border-border py-3",
        value && "text-success"
      )}
    >
      <label htmlFor={readOnly ? undefined : id} className={cn("min-w-0 text-sm font-medium text-foreground", !readOnly && "cursor-pointer")}>
        <span>{compact ? label : shortLabel}</span>
        <span
          className={cn("block text-xs font-normal", value ? "text-success" : "text-muted-foreground")}
        >
          {readOnly ? "Owner or manager can update" : compact ? status : pending ? "Saving…" : value ? `Done · ${hint}` : hint}
        </span>
      </label>
      {readOnly ? <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" aria-hidden /><span className="max-sm:sr-only">Read-only</span></span> : <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={toggle}
        disabled={pending}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70",
          value ? "bg-success" : "bg-input"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full bg-card shadow-xs transition-transform",
            value ? "translate-x-5 text-success" : "translate-x-0"
          )}
        >
          {value && <Check className="h-3 w-3" />}
        </span>
      </button>}
    </div>
  );
}

function usePaymentLink({
  slug,
  bookingId,
  clientName,
  hasEmail,
  inlineError,
}: {
  slug: string;
  bookingId: string;
  clientName: string;
  hasEmail: boolean;
  inlineError: boolean;
}) {
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const send = () =>
    startTransition(async () => {
      setFailed(false);
      try {
        const res = await sendBalanceLinkAction(slug, bookingId);
        setUrl(res.url);
        setOpen(true);
        toast(
          hasEmail
            ? `Payment link emailed to ${clientName}.`
            : `Payment link created. ${clientName} has no email on file — copy the link to share it.`
        );
      } catch {
        if (inlineError) setFailed(true);
        else toast("Couldn't create a payment link. Check that Stripe is connected and try again.", "error");
      }
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast("Payment link copied.");
    } catch {
      toast("Couldn't copy. Open the booking to see the link.", "error");
    }
  };

  return { pending, url, failed, send, copy, open, setOpen };
}

export function PaymentLinkItem({
  slug,
  bookingId,
  clientName,
  hasEmail,
  label,
  className,
  rowClassName,
  buttonClassName,
  before,
  amountLabel,
  dueLabel,
  children,
}: {
  slug: string;
  bookingId: string;
  clientName: string;
  hasEmail: boolean;
  label: string;
  className?: string;
  rowClassName?: string;
  buttonClassName?: string;
  before?: React.ReactNode;
  amountLabel?: string;
  dueLabel?: string;
  children: React.ReactNode;
}) {
  const linkId = React.useId();
  const { pending, url, failed, send, copy, open, setOpen } = usePaymentLink({
    slug,
    bookingId,
    clientName,
    hasEmail,
    inlineError: true,
  });
  return (
    <div className={className}>
      <div className={cn("flex flex-wrap items-center gap-3", rowClassName)}>
        {children}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {before}
          {url && (
            <Button size="sm" variant="ghost" onClick={copy} className="max-md:h-10" aria-label="Copy payment link">
              <Copy className="h-4 w-4" aria-hidden />
              <span className="max-md:sr-only">Copy</span>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={send} disabled={pending} className={cn("max-md:h-10", buttonClassName)}>
            {pending ? "Sending…" : url ? "Send again" : label}
          </Button>
        </div>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} ariaLabel="Payment link ready" variant="drawer" className="sm:max-w-md">
        <div className="flex h-full flex-col p-6 sm:p-8">
          <div className="flex items-start gap-3 pr-8"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"><CircleCheck className="h-5 w-5" aria-hidden /></span><div><h2 className="text-lg font-semibold">Payment link ready</h2><p className="mt-1 text-sm text-muted-foreground">Private payment link for {clientName}</p></div></div>
          {amountLabel && <div className="mt-6 flex items-center justify-between gap-3 rounded-lg bg-muted p-4 text-sm"><span className="text-muted-foreground">Amount due</span><span className="font-semibold">{amountLabel}{dueLabel ? ` · due ${dueLabel}` : ""}</span></div>}
          <label htmlFor={linkId} className="mt-6 text-sm font-medium">Payment link</label>
          <input id={linkId} readOnly value={url ?? ""} onFocus={(event) => event.target.select()} className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
          <Button onClick={copy} className="mt-4"><Copy className="h-4 w-4" aria-hidden />Copy link</Button>
          {url && <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-secondary text-sm font-medium hover:bg-muted"><ExternalLink className="h-4 w-4" aria-hidden />Open preview</a>}
          <div className="mt-auto border-t border-border pt-5"><p className="mb-3 text-xs text-muted-foreground">{hasEmail ? `Emailed to ${clientName}.` : "Copy this link and share it with your client."}</p><Button variant="outline" className="w-full" onClick={() => setOpen(false)}>Done</Button></div>
        </div>
      </Dialog>
      {failed && (
        <div
          role="alert"
          className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-destructive"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            Payment link failed. Retry?
          </span>
          <Button size="sm" variant="outline" onClick={send} disabled={pending} className="shrink-0 max-md:h-10">
            {pending ? "Retrying…" : "Retry"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Confirm button for a pending tour shown in Today's schedule. */
export function ConfirmTourButton({ slug, tour }: { slug: string; tour: Pick<TourView, "id" | "name"> }) {
  const { run, busy } = useTourStatus(slug);
  const isBusy = busy?.id === tour.id;
  return (
    <Button size="sm" disabled={isBusy} onClick={() => run(tour, "CONFIRMED")} className="max-md:h-10">
      {isBusy ? "Confirming…" : "Confirm"}
    </Button>
  );
}

/**
 * Pending tour requests with inline Confirm / Decline; clicking a tour opens
 * the drawer. Stacked list below xl (rail), two-column cards at xl.
 */
export function PendingTourRail({
  slug,
  tours,
  canManage,
  horizontal = false,
}: {
  slug: string;
  tours: TourView[];
  canManage: boolean;
  horizontal?: boolean;
}) {
  const tourStatus = useTourStatus(slug);
  const { run, busy } = tourStatus;
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [declineId, setDeclineId] = React.useState<string | null>(null);
  const open = tours.find((t) => t.id === openId) ?? null;

  return (
    <>
      <ul className={cn("divide-y divide-border", horizontal && "lg:grid lg:grid-cols-2 lg:gap-4 lg:divide-y-0")}>
        {tours.map((t) => {
          const isBusy = busy?.id === t.id;
          const asking = declineId === t.id;
          return (
            <li
              key={t.id}
              className={cn("py-5 first:pt-0 last:pb-0", horizontal && "lg:rounded-lg lg:border lg:border-border lg:p-5 lg:first:pt-5 lg:last:pb-5")}
            >
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setOpenId(t.id)}
                  className="-mx-1 flex w-[calc(100%+0.5rem)] items-start justify-between gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{t.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {t.when}
                      {t.spaceName ? ` · ${t.spaceName}` : ""}
                      {t.isPast ? " · time has passed" : ""}
                    </span>
                    <span className="sr-only">— view details</span>
                  </span>
                  <Badge variant="outline" className="mt-0.5 shrink-0">
                    Pending
                  </Badge>
                </button>
                {canManage && !asking && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button size="sm" disabled={isBusy} onClick={() => run(t, "CONFIRMED")} className="max-xl:h-10">
                      {isBusy && busy?.status === "CONFIRMED" ? "Confirming…" : "Confirm"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => setDeclineId(t.id)}
                      className="max-xl:h-10"
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>

            </li>
          );
        })}
      </ul>
      <Dialog open={declineId !== null} onClose={() => setDeclineId(null)} ariaLabel="Decline tour request">
        <h2 className="pr-8 text-lg font-semibold">Decline this tour request?</h2>
        <p className="mt-2 text-sm text-muted-foreground">The request from {tours.find((tour) => tour.id === declineId)?.name} will be removed from the pending list.</p>
        <div className="mt-6 flex justify-end gap-2"><Button variant="outline" disabled={!!busy} onClick={() => setDeclineId(null)}>Keep request</Button><Button variant="destructive" disabled={!!busy} onClick={async () => { const tour = tours.find((item) => item.id === declineId); if (tour && await run(tour, "DECLINED")) setDeclineId(null); }}>{busy?.status === "DECLINED" ? "Declining…" : "Decline request"}</Button></div>
      </Dialog>
      <TourDrawer tour={open} onClose={() => setOpenId(null)} canManage={canManage} tourStatus={tourStatus} />
    </>
  );
}
