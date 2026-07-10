"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { BookingStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import { computeSecurityRefund } from "@/lib/pricing";
import {
  cancelBookingAction,
  confirmWithDepositLinkAction,
  markNoShowAction,
  pencilHoldAction,
  recordManualPaymentAction,
  sendBalanceLinkAction,
  sendQuoteAction,
  settleSecurityDepositAction,
} from "@/actions/booking";
import { CopyButton } from "./copy-button";

interface Props {
  slug: string;
  bookingId: string;
  status: BookingStatus;
  isPast: boolean;
  currency: string;
  balanceCents: number;
  securityHeldCents: number;
}

type DialogKind = "pencil" | "manual" | "cancel" | "settle" | null;

function dollarsToCents(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function BookingActions({
  slug,
  bookingId,
  status,
  isPast,
  currency,
  balanceCents,
  securityHeldCents,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [depositUrl, setDepositUrl] = React.useState<string | null>(null);
  const [balanceUrl, setBalanceUrl] = React.useState<string | null>(null);

  // Pencil hold dialog
  const [pencilDays, setPencilDays] = React.useState("5");

  // Manual payment dialog
  const [payType, setPayType] = React.useState<"BOOKING_DEPOSIT" | "BALANCE" | "SECURITY_DEPOSIT">("BOOKING_DEPOSIT");
  const [payAmount, setPayAmount] = React.useState("");
  const [payError, setPayError] = React.useState<string | null>(null);

  // Cancel dialog
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelResult, setCancelResult] = React.useState<{
    refundCents: number;
    refundPct: number;
    securityRefundCents: number;
  } | null>(null);

  // Security settlement dialog
  const [deductions, setDeductions] = React.useState<{ reason: string; amount: string }[]>([]);
  const [settleError, setSettleError] = React.useState<string | null>(null);
  const [settleResult, setSettleResult] = React.useState<{
    refundCents: number;
    deductedCents: number;
  } | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setBusy(null);
    }
  };

  const quoteStage = status === "INQUIRY" || status === "QUOTE_SENT";
  const activeStage = (status === "PENCILED" || status === "CONFIRMED") && !isPast;
  const settleStage = (status === "CONFIRMED" && isPast) || status === "COMPLETED";

  const closeDialog = () => {
    setDialog(null);
    setCancelResult(null);
    setSettleResult(null);
    setPayError(null);
    setSettleError(null);
  };

  const settlePreview = computeSecurityRefund(
    securityHeldCents,
    deductions.map((d) => ({
      reason: d.reason || "Deduction",
      amountCents: Math.max(0, dollarsToCents(d.amount) || 0),
    }))
  );

  if (!quoteStage && !activeStage && !settleStage) {
    return (
      <p className="text-sm text-zinc-500">
        No actions available for this booking&apos;s current status.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}
      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {quoteStage && (
          <>
            <Button
              disabled={busy !== null}
              onClick={() =>
                run("quote", async () => {
                  await sendQuoteAction(slug, bookingId);
                  setNotice("Quote sent to the client by email.");
                  router.refresh();
                })
              }
            >
              {busy === "quote" ? "Sending…" : "Send quote"}
            </Button>
            <Button variant="outline" disabled={busy !== null} onClick={() => setDialog("pencil")}>
              Pencil hold
            </Button>
            <Button
              variant="success"
              disabled={busy !== null}
              onClick={() =>
                run("confirm", async () => {
                  const res = await confirmWithDepositLinkAction(slug, bookingId);
                  if (!res.ok) {
                    setError(res.error);
                    return;
                  }
                  setDepositUrl(res.depositUrl);
                  setNotice("Slot is held. Share the deposit link below — payment confirms the booking.");
                  router.refresh();
                })
              }
            >
              {busy === "confirm" ? "Working…" : "Confirm + deposit link"}
            </Button>
          </>
        )}

        {activeStage && (
          <>
            <Button
              disabled={busy !== null}
              onClick={() =>
                run("balance", async () => {
                  const res = await sendBalanceLinkAction(slug, bookingId);
                  setBalanceUrl(res.url);
                  setNotice("Payment link created (and emailed if we have the client's email).");
                  router.refresh();
                })
              }
            >
              {busy === "balance" ? "Working…" : "Send balance payment link"}
            </Button>
            <Button variant="outline" disabled={busy !== null} onClick={() => setDialog("manual")}>
              Record manual payment
            </Button>
            <Button variant="destructive" disabled={busy !== null} onClick={() => setDialog("cancel")}>
              Cancel booking
            </Button>
          </>
        )}

        {settleStage && (
          <>
            {status === "CONFIRMED" && (
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  run("noshow", async () => {
                    await markNoShowAction(slug, bookingId);
                    setNotice("Marked as a no-show.");
                    router.refresh();
                  })
                }
              >
                {busy === "noshow" ? "Working…" : "Mark no-show"}
              </Button>
            )}
            <Button
              disabled={busy !== null || securityHeldCents <= 0}
              onClick={() => setDialog("settle")}
            >
              Settle security deposit
            </Button>
            {securityHeldCents <= 0 && (
              <p className="w-full text-xs text-zinc-500">
                No security deposit is currently held for this booking.
              </p>
            )}
          </>
        )}
      </div>

      {depositUrl && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-2 text-sm font-medium text-emerald-800">Deposit payment link</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 text-xs text-zinc-700">
              {depositUrl}
            </code>
            <CopyButton value={depositUrl} />
          </div>
        </div>
      )}

      {balanceUrl && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <p className="mb-2 text-sm font-medium text-indigo-800">Balance payment link</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 text-xs text-zinc-700">
              {balanceUrl}
            </code>
            <CopyButton value={balanceUrl} />
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Pencil hold dialog */}
      <Dialog open={dialog === "pencil"} onClose={closeDialog}>
        <DialogTitle>Pencil hold</DialogTitle>
        <DialogDescription>
          Softly reserve this slot for the client. The hold blocks other bookings until it
          expires, then releases automatically.
        </DialogDescription>
        <Label htmlFor="pencil-days">Hold for how many days?</Label>
        <Input
          id="pencil-days"
          type="number"
          min={1}
          max={30}
          value={pencilDays}
          onChange={(e) => setPencilDays(e.target.value)}
          className="max-w-32"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={closeDialog}>
            Close
          </Button>
          <Button
            disabled={busy !== null}
            onClick={() =>
              run("pencil", async () => {
                const days = Math.min(Math.max(Number.parseInt(pencilDays, 10) || 5, 1), 30);
                const res = await pencilHoldAction(slug, bookingId, days);
                if (!res.ok) {
                  setError(res.error);
                } else {
                  setNotice(`Penciled in — the slot is held for ${days} day${days === 1 ? "" : "s"}.`);
                }
                closeDialog();
                router.refresh();
              })
            }
          >
            {busy === "pencil" ? "Holding…" : "Place hold"}
          </Button>
        </div>
      </Dialog>

      {/* -------------------------------------------- Manual payment dialog */}
      <Dialog open={dialog === "manual"} onClose={closeDialog}>
        <DialogTitle>Record a manual payment</DialogTitle>
        <DialogDescription>
          For cash or bank transfers you received outside Venuora. Recording a deposit
          confirms the booking.
        </DialogDescription>
        {payError && (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{payError}</p>
        )}
        <div className="space-y-3">
          <div>
            <Label htmlFor="pay-type">What is this payment for?</Label>
            <Select
              id="pay-type"
              value={payType}
              onChange={(e) => setPayType(e.target.value as typeof payType)}
            >
              <option value="BOOKING_DEPOSIT">Deposit</option>
              <option value="BALANCE">Balance</option>
              <option value="SECURITY_DEPOSIT">Security deposit</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="pay-amount">Amount</Label>
            <div className="relative max-w-40">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                $
              </span>
              <Input
                id="pay-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="pl-7"
                placeholder="0.00"
              />
            </div>
            {balanceCents > 0 && (
              <p className="mt-1 text-xs text-zinc-500">
                Outstanding balance: {formatMoney(balanceCents, currency)}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={closeDialog}>
            Close
          </Button>
          <Button
            disabled={busy !== null}
            onClick={() =>
              run("manual", async () => {
                setPayError(null);
                const cents = dollarsToCents(payAmount);
                if (!Number.isInteger(cents) || cents <= 0) {
                  setPayError("Enter a valid amount in dollars, e.g. 250.00");
                  return;
                }
                const res = await recordManualPaymentAction(slug, bookingId, payType, cents);
                if (!res.ok) {
                  setPayError(res.error);
                  return;
                }
                setNotice(`Recorded ${formatMoney(cents, currency)} — thank you.`);
                setPayAmount("");
                closeDialog();
                router.refresh();
              })
            }
          >
            {busy === "manual" ? "Saving…" : "Record payment"}
          </Button>
        </div>
      </Dialog>

      {/* --------------------------------------------------- Cancel dialog */}
      <Dialog open={dialog === "cancel"} onClose={closeDialog}>
        <DialogTitle>Cancel this booking</DialogTitle>
        {cancelResult ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Booking cancelled.
            </p>
            <div className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700">
              <p>
                Refund to client:{" "}
                <strong>{formatMoney(cancelResult.refundCents, currency)}</strong>{" "}
                ({cancelResult.refundPct}% of what they paid, per your cancellation policy).
              </p>
              {cancelResult.securityRefundCents > 0 && (
                <p className="mt-1">
                  Security deposit refunded in full:{" "}
                  <strong>{formatMoney(cancelResult.securityRefundCents, currency)}</strong>
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={closeDialog}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <DialogDescription>
              The refund follows your cancellation policy automatically, and the client is
              notified by email. The slot frees up right away.
            </DialogDescription>
            <Label htmlFor="cancel-reason">Reason (shared with the client)</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Client requested to cancel"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeDialog}>
                Keep booking
              </Button>
              <Button
                variant="destructive"
                disabled={busy !== null}
                onClick={() =>
                  run("cancel", async () => {
                    const res = await cancelBookingAction(slug, bookingId, cancelReason.trim());
                    setCancelResult({
                      refundCents: res.refundCents,
                      refundPct: res.refundPct,
                      securityRefundCents: res.securityRefundCents,
                    });
                    router.refresh();
                  })
                }
              >
                {busy === "cancel" ? "Cancelling…" : "Cancel booking"}
              </Button>
            </div>
          </>
        )}
      </Dialog>

      {/* --------------------------------------- Security settlement dialog */}
      <Dialog open={dialog === "settle"} onClose={closeDialog}>
        <DialogTitle>Settle the security deposit</DialogTitle>
        {settleResult ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Security deposit settled.
            </p>
            <div className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700">
              <p>
                Refunded to client:{" "}
                <strong>{formatMoney(settleResult.refundCents, currency)}</strong>
              </p>
              <p className="mt-1">
                Kept for damages/deductions:{" "}
                <strong>{formatMoney(settleResult.deductedCents, currency)}</strong>
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={closeDialog}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <DialogDescription>
              List anything you need to deduct (damage, extra cleaning, missing items). The
              rest is refunded to the client automatically.
            </DialogDescription>
            {settleError && (
              <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {settleError}
              </p>
            )}
            <div className="space-y-2">
              {deductions.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={d.reason}
                    onChange={(e) =>
                      setDeductions((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, reason: e.target.value } : r))
                      )
                    }
                    placeholder="Reason, e.g. Broken chair"
                    className="flex-1"
                  />
                  <div className="relative w-28 shrink-0">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={d.amount}
                      onChange={(e) =>
                        setDeductions((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r))
                        )
                      }
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove deduction"
                    onClick={() => setDeductions((rows) => rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4 text-zinc-500" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeductions((rows) => [...rows, { reason: "", amount: "" }])}
              >
                <Plus className="h-3.5 w-3.5" /> Add deduction
              </Button>
            </div>
            <p className="mt-4 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
              Will refund <strong>{formatMoney(settlePreview.refundCents, currency)}</strong> of{" "}
              {formatMoney(securityHeldCents, currency)} held
              {settlePreview.deductedCents > 0 && (
                <> (keeping {formatMoney(settlePreview.deductedCents, currency)})</>
              )}
              .
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeDialog}>
                Close
              </Button>
              <Button
                disabled={busy !== null}
                onClick={() =>
                  run("settle", async () => {
                    setSettleError(null);
                    const clean = deductions
                      .filter((d) => d.reason.trim() || d.amount.trim())
                      .map((d) => ({
                        reason: d.reason.trim() || "Deduction",
                        amountCents: Math.max(0, dollarsToCents(d.amount) || 0),
                      }));
                    const res = await settleSecurityDepositAction(slug, bookingId, {
                      deductions: clean,
                    });
                    if (!res.ok) {
                      setSettleError(res.error);
                      return;
                    }
                    setSettleResult({
                      refundCents: res.refundCents,
                      deductedCents: res.deductedCents,
                    });
                    router.refresh();
                  })
                }
              >
                {busy === "settle" ? "Settling…" : "Refund & settle"}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
