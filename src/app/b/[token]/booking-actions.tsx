"use client";

// Client-side booking management: pay the balance, or cancel with a live
// refund preview under the venue's tiered policy.

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  cancelByTokenAction,
  cancellationPreviewByToken,
  payBalanceByTokenAction,
} from "@/actions/public";
import { formatMoney } from "@/lib/money";
import { textOnColor } from "@/lib/color";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Preview = Extract<
  Awaited<ReturnType<typeof cancellationPreviewByToken>>,
  { ok: true }
>;

export function BookingActions({
  token,
  brandColor,
  currency,
  canPayBalance,
  payAmountCents,
  includesSecurity,
  canCancel,
  spaceName,
  dateLabel,
  timeLabel,
  securityHeldCents,
  policySentences,
}: {
  token: string;
  brandColor: string;
  currency: string;
  canPayBalance: boolean;
  payAmountCents: number;
  includesSecurity: boolean;
  canCancel: boolean;
  spaceName: string;
  dateLabel: string;
  timeLabel: string;
  securityHeldCents: number;
  policySentences: string[];
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [paying, setPaying] = React.useState(false);

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [cancelled, setCancelled] = React.useState<{
    refundCents: number;
    refundPct: number;
    securityRefundCents: number;
  } | null>(null);

  async function payBalance() {
    setPaying(true);
    setError(null);
    try {
      const res = await payBalanceByTokenAction(token);
      if (res.ok) {
        window.location.href = res.url;
        return;
      }
      setError(res.error);
    } catch {
      setError("Could not start the payment — please try again.");
    } finally {
      setPaying(false);
    }
  }

  async function openCancel() {
    setCancelOpen(true);
    setAcknowledged(false);
    setPreview(null);
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await cancellationPreviewByToken(token);
      if (res.ok) setPreview(res);
      else setError(res.error);
    } catch {
      setError("Could not load your refund preview — please try again.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function closeCancel() {
    setCancelOpen(false);
    setError(null);
  }

  async function confirmCancel() {
    if (!acknowledged) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await cancelByTokenAction(token, reason.trim());
      if (res.ok) {
        setCancelled({
          refundCents: res.refundCents,
          refundPct: res.refundPct,
          securityRefundCents: res.securityRefundCents,
        });
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Could not cancel the booking — please try again.");
    } finally {
      setCancelling(false);
    }
  }

  const nonRefundableCents = preview ? Math.max(0, preview.paidCents - preview.refundCents) : 0;
  const payTextColor = textOnColor(brandColor);

  return (
    <>
      {(canPayBalance || canCancel) && (
        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Manage this booking</h2>
          <div className="mt-4">
      {error && !cancelOpen && (
        <Callout tone="danger" className="mb-3">
          {error}
        </Callout>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {canPayBalance && (
          <button
            onClick={payBalance}
            disabled={paying}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-medium shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-60"
            style={{ backgroundColor: brandColor, color: payTextColor }}
          >
            {paying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Pay balance — {formatMoney(payAmountCents, currency)}
            {includesSecurity ? " (incl. security deposit)" : ""}
          </button>
        )}
        {canCancel && (
          <Button variant="destructive-outline" className="h-11" onClick={openCancel}>
            Cancel booking
          </Button>
        )}
      </div>
          </div>
        </Card>
      )}

      <Dialog
        open={cancelOpen}
        onClose={() => !cancelling && closeCancel()}
        className="sm:max-w-xl max-sm:m-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0 max-sm:[&>div]:h-full max-sm:[&>div]:max-h-none"
      >
        {cancelled ? (
          <div className="flex min-h-full flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
            <DialogTitle className="mt-3 pr-0">Booking cancelled</DialogTitle>
            <DialogDescription>
              {cancelled.refundCents + cancelled.securityRefundCents > 0 ? (
                <>
                  A refund of{" "}
                  <strong className="text-foreground">
                    {formatMoney(
                      cancelled.refundCents + cancelled.securityRefundCents,
                      currency
                    )}
                  </strong>{" "}
                  ({cancelled.refundPct}% of payments
                  {cancelled.securityRefundCents > 0 ? " plus your full security deposit" : ""}) is
                  on its way back to your card.
                </>
              ) : (
                "Per the venue's policy, no refund applies at this notice period."
              )}
            </DialogDescription>
            <Button variant="outline" onClick={closeCancel}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-destructive">Destructive action</p>
              <DialogTitle className="mt-2 text-[26px] leading-tight sm:text-[28px]">
                Cancel this booking?
              </DialogTitle>
              <DialogDescription className="mb-0 mt-2 text-[15px]">
                This will release your date and cannot be undone.
              </DialogDescription>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{dateLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {timeLabel} · {spaceName}
                </p>
              </div>
              <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </div>

            <Callout tone="danger" icon={AlertTriangle}>
              The date will be released and this booking cannot be restored.
            </Callout>

            <section aria-labelledby="refund-preview-heading">
              <h3 id="refund-preview-heading" className="text-base font-semibold text-foreground">
                Refund preview
              </h3>
              {previewLoading ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Checking your refund under the venue&apos;s policy…
                </p>
              ) : preview ? (
                <>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <Tile label="Paid" value={formatMoney(preview.paidCents, currency)} />
                    <Tile
                      label="Estimated refund"
                      value={formatMoney(preview.refundCents, currency)}
                      hint={`${preview.refundPct}% of what you've paid`}
                    />
                    <Tile
                      label="Non-refundable"
                      value={formatMoney(nonRefundableCents, currency)}
                    />
                    <Tile
                      label="Security deposit"
                      value={formatMoney(securityHeldCents, currency)}
                      hint={securityHeldCents > 0 ? "Refunded in full" : "None held"}
                    />
                  </dl>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Cancelling today is {preview.daysBefore} day
                    {preview.daysBefore === 1 ? "" : "s"} before your event.
                  </p>
                </>
              ) : null}
            </section>

            {policySentences.length > 0 && (
              <Callout tone="info" icon={null} title="Cancellation policy">
                <ul className="space-y-1 text-muted-foreground">
                  {policySentences.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </Callout>
            )}

            {error && <Callout tone="danger">{error}</Callout>}

            <div>
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Textarea
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Let the venue know why you're cancelling…"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-[15px] text-foreground">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-input accent-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              I understand this releases the date
            </label>

            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                size="lg"
                onClick={closeCancel}
                disabled={cancelling}
                className="w-full sm:w-auto"
              >
                Keep booking
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={confirmCancel}
                disabled={!acknowledged || cancelling || previewLoading || !preview}
                className="w-full sm:w-auto"
              >
                {cancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <XCircle className="h-4 w-4" aria-hidden />
                )}
                Cancel booking
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
