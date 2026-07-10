"use client";

// Client-side booking management: pay the balance, or cancel with a live
// refund preview under the venue's tiered policy.

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  cancelByTokenAction,
  cancellationPreviewByToken,
  payBalanceByTokenAction,
} from "@/actions/public";
import { formatMoney } from "@/lib/money";
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
}: {
  token: string;
  brandColor: string;
  currency: string;
  canPayBalance: boolean;
  payAmountCents: number;
  includesSecurity: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [paying, setPaying] = React.useState(false);

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [reason, setReason] = React.useState("");
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

  async function confirmCancel() {
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

  return (
    <div>
      {error && !cancelOpen && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {canPayBalance && (
          <button
            onClick={payBalance}
            disabled={paying}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
            style={{ backgroundColor: brandColor }}
          >
            {paying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Pay balance — {formatMoney(payAmountCents, currency)}
            {includesSecurity ? " (incl. security deposit)" : ""}
          </button>
        )}
        {canCancel && (
          <Button variant="outline" className="h-11" onClick={openCancel}>
            Cancel booking
          </Button>
        )}
      </div>

      <Dialog open={cancelOpen} onClose={() => !cancelling && setCancelOpen(false)}>
        {cancelled ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden />
            <DialogTitle className="mt-3">Booking cancelled</DialogTitle>
            <DialogDescription>
              {cancelled.refundCents + cancelled.securityRefundCents > 0 ? (
                <>
                  A refund of{" "}
                  <strong>
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
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div>
            <DialogTitle>Cancel this booking?</DialogTitle>
            {previewLoading ? (
              <p className="flex items-center gap-2 py-3 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Checking your refund under the venue&apos;s policy…
              </p>
            ) : preview ? (
              <div className="mb-4 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
                <p>
                  Cancelling today ({preview.daysBefore} day
                  {preview.daysBefore === 1 ? "" : "s"} before your event) refunds{" "}
                  <strong>{preview.refundPct}%</strong> of the{" "}
                  {formatMoney(preview.paidCents, currency)} you&apos;ve paid ={" "}
                  <strong>{formatMoney(preview.refundCents, currency)}</strong>.
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Any security deposit you&apos;ve paid is always refunded in full.
                </p>
              </div>
            ) : null}
            {error && (
              <p
                role="alert"
                className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                {error}
              </p>
            )}
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Let the venue know why you're cancelling…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setCancelOpen(false)}
                disabled={cancelling}
              >
                Keep booking
              </Button>
              <Button
                variant="destructive"
                onClick={confirmCancel}
                disabled={cancelling || previewLoading}
              >
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Cancel booking
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
