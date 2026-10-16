"use client";

// Every lifecycle action for one booking. A context provider owns the dialog
// / drawer state so the header ("primary + More actions") and the sticky
// bottom bar trigger the same flows. Status gating mirrors the original
// rules (quoteStage / activeStage / settleStage), plus PENCILED (not past)
// gaining "Confirm + deposit link".

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Ban,
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  MoreHorizontal,
  PencilLine,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { BookingStatus } from "@/generated/prisma/enums";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { addDays, formatInVenueTz, venueDateStr } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { computeSecurityRefund } from "@/lib/pricing";
import { STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
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
import { cancellationPreviewByToken } from "@/actions/public";
import { CopyButton } from "./copy-button";

export interface BookingActionsData {
  slug: string;
  bookingId: string;
  status: BookingStatus;
  isPast: boolean;
  currency: string;
  paidCents: number;
  balanceCents: number;
  depositCents: number;
  securityHeldCents: number;
  /** Security deposit still to collect (agreed − held, ≥ 0). */
  securityOutstandingCents: number;
  manageToken: string;
  manageUrl: string;
  clientName: string;
  clientEmail: string | null;
  spaceName: string;
  eventTypeLabel: string;
  timezone: string;
  eventDate: string;
  eventTime: string;
  totalCents: number;
}

type DialogKind = "pencil" | "manual" | "cancel" | "settle" | "noshow" | null;
type PayType = "BOOKING_DEPOSIT" | "BALANCE" | "SECURITY_DEPOSIT";

type LinkDrawer = {
  kind: "balance" | "deposit";
  phase: "loading" | "ready" | "error";
  amountCents: number;
  url?: string;
  error?: string;
};

interface ActionItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: "default" | "destructive";
  disabled?: boolean;
  hint?: string;
}

interface Ctx {
  data: BookingActionsData;
  busy: string | null;
  primary: ActionItem | null;
  more: ActionItem[];
  bar: ActionItem[];
  hasLifecycle: boolean;
}

const ActionsContext = React.createContext<Ctx | null>(null);

function useActions(): Ctx {
  const ctx = React.useContext(ActionsContext);
  if (!ctx) throw new Error("useActions must be used inside <BookingActionsProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Money input helpers (inputs stay in major units, e.g. 250.00)
// ---------------------------------------------------------------------------

function majorToCents(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function centsToMajor(cents: number): string {
  return (cents / 100).toFixed(2);
}

function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency.toUpperCase();
  } catch {
    return currency.toUpperCase();
  }
}

function MoneyInput({
  currency,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { currency: string }) {
  const symbol = currencySymbol(currency);
  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
      >
        {symbol}
      </span>
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="0.00"
        {...props}
        style={{ paddingLeft: `${Math.max(1.75, 0.9 + symbol.length * 0.55)}rem` }}
      />
    </div>
  );
}

const PAY_TYPE_LABELS: Record<PayType, string> = {
  BOOKING_DEPOSIT: "Deposit",
  BALANCE: "Balance",
  SECURITY_DEPOSIT: "Security deposit",
};

// ---------------------------------------------------------------------------
// Provider: state, gating, dialogs, drawer
// ---------------------------------------------------------------------------

export function BookingActionsProvider({
  data,
  children,
}: {
  data: BookingActionsData;
  children: React.ReactNode;
}) {
  const {
    slug,
    bookingId,
    status,
    isPast,
    currency,
    paidCents,
    balanceCents,
    depositCents,
    securityHeldCents,
    securityOutstandingCents,
    manageToken,
  } = data;
  const router = useRouter();
  const toast = useToast();
  const money = (c: number) => formatMoney(c, currency);

  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [drawer, setDrawer] = React.useState<LinkDrawer | null>(null);

  // Pencil hold
  const [paymentDate, setPaymentDate] = React.useState(() => venueDateStr(new Date(), data.timezone));
  const [paymentMethod, setPaymentMethod] = React.useState("Bank transfer");
  const [paymentNote, setPaymentNote] = React.useState("");
  const [pencilDays, setPencilDays] = React.useState("1");

  // Manual payment
  const depositOutstanding = Math.max(0, Math.min(depositCents - paidCents, balanceCents));
  const outstandingFor = (t: PayType) =>
    t === "BOOKING_DEPOSIT"
      ? depositOutstanding
      : t === "BALANCE"
        ? balanceCents
        : securityOutstandingCents;
  const [payType, setPayType] = React.useState<PayType>("BALANCE");
  const [payAmount, setPayAmount] = React.useState("");
  const [payTouched, setPayTouched] = React.useState(false);

  // Cancel
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelPreview, setCancelPreview] = React.useState<
    | { phase: "loading" }
    | { phase: "ready"; refundPct: number; refundCents: number; paidCents: number }
    | { phase: "error" }
  >({ phase: "loading" });
  const [cancelResult, setCancelResult] = React.useState<{
    refundCents: number;
    refundPct: number;
    securityRefundCents: number;
  } | null>(null);

  // Security settlement
  const [deductions, setDeductions] = React.useState<{ reason: string; amount: string }[]>([]);
  const [settleResult, setSettleResult] = React.useState<{
    refundCents: number;
    deductedCents: number;
  } | null>(null);

  const errMsg = (err: unknown) =>
    err instanceof Error ? err.message : "Something went wrong — please try again.";

  const closeDialog = () => {
    setDialog(null);
    setDialogError(null);
    setCancelResult(null);
    setSettleResult(null);
  };

  // ---- openers -----------------------------------------------------------
  const openManual = () => {
    const t: PayType =
      status !== "CONFIRMED" && depositOutstanding > 0
        ? "BOOKING_DEPOSIT"
        : balanceCents > 0
          ? "BALANCE"
          : securityOutstandingCents > 0
            ? "SECURITY_DEPOSIT"
            : "BALANCE";
    setPayType(t);
    const o = outstandingFor(t);
    setPayAmount(o > 0 ? centsToMajor(o) : "");
    setPayTouched(false);
    setDialogError(null);
    setDialog("manual");
  };

  const openCancel = () => {
    setCancelReason("");
    setCancelResult(null);
    setDialogError(null);
    setCancelPreview({ phase: "loading" });
    setDialog("cancel");
    cancellationPreviewByToken(manageToken)
      .then((res) => {
        if (res.ok) {
          setCancelPreview({
            phase: "ready",
            refundPct: res.refundPct,
            refundCents: res.refundCents,
            paidCents: res.paidCents,
          });
        } else {
          setCancelPreview({ phase: "error" });
        }
      })
      .catch(() => setCancelPreview({ phase: "error" }));
  };

  const openSettle = () => {
    setDeductions([]);
    setSettleResult(null);
    setDialogError(null);
    setDialog("settle");
  };

  const open = (k: Exclude<DialogKind, null>) => {
    setDialogError(null);
    setDialog(k);
  };

  // ---- direct actions ----------------------------------------------------
  const sendQuote = async () => {
    setBusy("quote");
    try {
      await sendQuoteAction(slug, bookingId);
      toast(status === "QUOTE_SENT" ? "Quote re-sent to the client" : "Quote sent to the client");
      router.refresh();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(null);
    }
  };

  const generateLink = async (kind: LinkDrawer["kind"]) => {
    const amountCents = kind === "balance" ? balanceCents + securityOutstandingCents : depositCents;
    setDrawer({ kind, phase: "loading", amountCents });
    setBusy(kind);
    try {
      if (kind === "deposit") {
        const res = await confirmWithDepositLinkAction(slug, bookingId);
        if (!res.ok) {
          setDrawer({ kind, phase: "error", amountCents, error: res.error });
          return;
        }
        setDrawer({ kind, phase: "ready", amountCents, url: res.depositUrl });
        toast("Private deposit link generated");
      } else {
        const res = await sendBalanceLinkAction(slug, bookingId);
        setDrawer({ kind, phase: "ready", amountCents, url: res.url });
        toast("Private balance link generated");
      }
      router.refresh();
    } catch (err) {
      setDrawer({ kind, phase: "error", amountCents, error: errMsg(err) });
    } finally {
      setBusy(null);
    }
  };

  // ---- gating ------------------------------------------------------------
  const quoteStage = status === "INQUIRY" || status === "QUOTE_SENT";
  const activeStage = (status === "PENCILED" || status === "CONFIRMED") && !isPast;
  const settleStage = (status === "CONFIRMED" && isPast) || status === "COMPLETED";
  const balanceOutstanding = balanceCents + securityOutstandingCents;

  const A = {
    quote: {
      key: "quote",
      label: status === "QUOTE_SENT" ? "Resend quote" : "Send quote",
      icon: Send,
      onSelect: sendQuote,
    },
    pencil: { key: "pencil", label: "Pencil hold", icon: PencilLine, onSelect: () => open("pencil") },
    deposit: {
      key: "deposit",
      label: "Confirm + deposit link",
      icon: Link2,
      onSelect: () => generateLink("deposit"),
    },
    balance: {
      key: "balance",
      label: "Send balance payment link",
      icon: Send,
      onSelect: () => generateLink("balance"),
    },
    manual: {
      key: "manual",
      label: "Record manual payment",
      icon: BadgeDollarSign,
      onSelect: openManual,
    },
    cancel: {
      key: "cancel",
      label: "Cancel booking",
      icon: Ban,
      tone: "destructive" as const,
      onSelect: openCancel,
    },
    noshow: { key: "noshow", label: "Mark no-show", icon: UserX, onSelect: () => open("noshow") },
    settle: {
      key: "settle",
      label: "Settle security deposit",
      icon: ShieldCheck,
      onSelect: openSettle,
      disabled: securityHeldCents <= 0,
      hint: securityHeldCents <= 0 ? "No security deposit is currently held" : undefined,
    },
  } satisfies Record<string, ActionItem>;

  let primary: ActionItem | null = null;
  let more: ActionItem[] = [];
  let bar: ActionItem[] = [];
  if (quoteStage) {
    // INQUIRY / QUOTE_SENT: send quote · pencil hold · confirm + deposit link
    primary = A.quote;
    more = [A.pencil, A.deposit];
  } else if (activeStage && status === "PENCILED") {
    // PENCILED, not past: confirm + deposit link · balance link · manual · cancel
    primary = A.deposit;
    more = [...(balanceOutstanding > 0 ? [A.balance] : []), A.manual, A.cancel];
    bar = [A.manual, A.cancel];
  } else if (activeStage) {
    // CONFIRMED, not past: balance link · manual · cancel
    primary = balanceOutstanding > 0 ? A.balance : null;
    more = [A.manual, A.cancel];
    bar = [A.manual, A.cancel];
  } else if (settleStage) {
    // CONFIRMED & past: no-show · settle. COMPLETED: settle.
    primary = securityHeldCents > 0 ? A.settle : null;
    more = [...(status === "CONFIRMED" ? [A.noshow] : []), ...(primary ? [] : [A.settle])];
    bar = status === "CONFIRMED" ? [A.noshow] : [];
  }

  const requestedDeductionCents = deductions.reduce(
    (s, d) => s + Math.max(0, majorToCents(d.amount) || 0),
    0
  );
  const settlePreview = computeSecurityRefund(
    securityHeldCents,
    deductions.map((d) => ({
      reason: d.reason || "Deduction",
      amountCents: Math.max(0, majorToCents(d.amount) || 0),
    }))
  );

  // Manual-payment validation
  const payCents = majorToCents(payAmount);
  const payInvalid = !Number.isInteger(payCents) || payCents <= 0;
  const payOutstanding = outstandingFor(payType);
  const payOver = !payInvalid && payCents > payOutstanding;

  const ctx: Ctx = {
    data,
    busy,
    primary,
    more,
    bar,
    hasLifecycle: primary !== null || more.length > 0,
  };

  return (
    <ActionsContext.Provider value={ctx}>
      {children}

      {/* ------------------------------------------------ Pencil hold */}
      <Dialog open={dialog === "pencil"} onClose={closeDialog}>
        <DialogTitle>Pencil this booking</DialogTitle>
        <DialogDescription>
          Softly reserve this slot for {data.clientName}. The hold blocks other bookings until it
          expires, then releases automatically.
        </DialogDescription>
        {dialogError && (
          <Callout tone="danger" className="mb-4">
            {dialogError}
          </Callout>
        )}
        <div className="mb-5 rounded-xl border border-border bg-background p-4"><div className="flex justify-between gap-3"><p className="font-semibold">{data.clientName}</p><span className="text-sm font-semibold">{money(data.totalCents)}</span></div><p className="mt-2 text-xs text-muted-foreground">{data.eventDate} · {data.eventTime}</p><p className="mt-1 text-xs text-muted-foreground">{data.spaceName}</p></div>
        <fieldset><legend className="text-sm font-semibold">Hold duration</legend><p className="mt-1 text-xs text-muted-foreground">Choose how long the booking remains reserved.</p><div className="mt-3 grid grid-cols-3 gap-2">{[1, 2, 3].map((days) => <label key={days} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs"><input type="radio" name="pencil-duration" className="accent-primary" value={days} checked={pencilDays === String(days)} onChange={() => setPencilDays(String(days))} />{days * 24} hours</label>)}</div></fieldset>
        <Callout tone="info" className="mt-5">Expires {formatInVenueTz(addDays(new Date(), Number(pencilDays)), data.timezone, "MMM d yyyy 'at' h:mm a")} · {data.timezone}</Callout>
        <DialogFooter>
          <Button variant="ghost" onClick={closeDialog}>
            Close
          </Button>
          <Button
            disabled={busy !== null}
            onClick={async () => {
              setBusy("pencil");
              setDialogError(null);
              try {
                const days = Math.min(Math.max(Number.parseInt(pencilDays, 10) || 5, 1), 30);
                const res = await pencilHoldAction(slug, bookingId, days);
                if (!res.ok) {
                  setDialogError(res.error);
                  return;
                }
                toast(`Penciled in — the slot is held for ${days} day${days === 1 ? "" : "s"}`);
                closeDialog();
                router.refresh();
              } catch (err) {
                setDialogError(errMsg(err));
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "pencil" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy === "pencil" ? "Holding…" : "Place hold"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* -------------------------------------------- Manual payment */}
      <Dialog open={dialog === "manual"} onClose={closeDialog} className="max-w-3xl">
        <p className="mb-2 text-xs font-medium text-primary">{data.clientName} · {STATUS_LABELS[status]} booking</p>
        <DialogTitle>Record manual payment</DialogTitle>
        <DialogDescription>
          For cash or bank transfers you received outside Venuora. Recording a deposit confirms
          the booking once the required deposit amount has been received.
        </DialogDescription>
        {dialogError && (
          <Callout tone="danger" className="mb-4">
            {dialogError}
          </Callout>
        )}
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_240px]"><div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Payment type</p>
            <div role="group" aria-label="Payment type" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">{(["BOOKING_DEPOSIT", "BALANCE", "SECURITY_DEPOSIT"] as const).map((type) => <button type="button" key={type} aria-pressed={payType === type} onClick={() => { setPayType(type); const amount = outstandingFor(type); setPayAmount(amount > 0 ? centsToMajor(amount) : ""); setPayTouched(false); }} className={cn("min-h-11 rounded-md px-2 text-xs", payType === type && "border border-border bg-card shadow-sm")}>{PAY_TYPE_LABELS[type]}</button>)}</div>
          </div>
          <div>
            <Label htmlFor="pay-amount">Amount received</Label>
            <MoneyInput
              id="pay-amount"
              currency={currency}
              className="max-w-48"
              min="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              onBlur={() => setPayTouched(true)}
              aria-invalid={payTouched && payInvalid ? true : undefined}
              aria-describedby="pay-amount-hint"
            />
            <FieldHint id="pay-amount-hint" error={payTouched && payInvalid}>
              {payTouched && payInvalid
                ? "Enter an amount greater than zero, e.g. 250.00"
                : payOutstanding > 0
                  ? `Outstanding ${PAY_TYPE_LABELS[payType].toLowerCase()}: ${money(payOutstanding)}`
                  : `Nothing is outstanding for the ${PAY_TYPE_LABELS[payType].toLowerCase()}.`}
            </FieldHint>
          </div>
          <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="payment-date">Date received</Label><Input id="payment-date" type="date" value={paymentDate} max={venueDateStr(new Date(), data.timezone)} onChange={(event) => setPaymentDate(event.target.value)} /></div><div><Label htmlFor="payment-method">Method</Label><Select id="payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{["Bank transfer", "Cash", "Card", "Other"].map((method) => <option key={method}>{method}</option>)}</Select></div></div><div><Label htmlFor="payment-note">Note (optional)</Label><Textarea id="payment-note" maxLength={1000} value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Add an internal note" /></div>
          {payOver && (
            <Callout tone="warning">
              {money(payCents)} is more than the {money(payOutstanding)} outstanding for the{" "}
              {PAY_TYPE_LABELS[payType].toLowerCase()}. Double-check the amount — you can still
              record it.
            </Callout>
          )}
        </div>
        <aside className="self-start rounded-xl border border-border bg-background p-5"><h3 className="mb-4 text-sm font-semibold">Payment summary</h3><dl className="divide-y divide-border text-xs"><div className="flex justify-between gap-3 py-3"><dt>Before balance</dt><dd className="font-semibold">{money(balanceCents)}</dd></div><div className="flex justify-between gap-3 py-3"><dt>After balance</dt><dd className="font-semibold">{money(Math.max(0, balanceCents - (payType === "SECURITY_DEPOSIT" ? 0 : payCents)))}</dd></div><div className="flex justify-between gap-3 py-3"><dt>Booking status</dt><dd className="text-primary">{STATUS_LABELS[status]}</dd></div></dl><p className="mt-4 text-xs text-muted-foreground">Only record money you have already received.</p></aside></div>
        <DialogFooter>
          <Button variant="ghost" onClick={closeDialog}>
            Close
          </Button>
          <Button
            disabled={busy !== null}
            onClick={async () => {
              setPayTouched(true);
              if (payInvalid) return;
              setBusy("manual");
              setDialogError(null);
              try {
                const res = await recordManualPaymentAction(slug, bookingId, payType, payCents, { date: paymentDate, method: paymentMethod, note: paymentNote });
                if (!res.ok) {
                  setDialogError(res.error);
                  return;
                }
                toast(`Recorded ${money(payCents)} ${PAY_TYPE_LABELS[payType].toLowerCase()} payment`);
                closeDialog();
                router.refresh();
              } catch (err) {
                setDialogError(errMsg(err));
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "manual" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy === "manual" ? "Saving…" : "Record payment"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* --------------------------------------------------- Cancel */}
      <Dialog open={dialog === "cancel"} onClose={closeDialog}>
        {!cancelResult && <p className="mb-2 text-xs font-medium text-destructive">Destructive action</p>}
        <DialogTitle>{cancelResult ? "Booking cancelled" : `Cancel ${data.clientName}’s booking?`}</DialogTitle>
        {cancelResult ? (
          <>
            <DialogDescription>
              The slot is free again and {data.clientName} has been notified by email.
            </DialogDescription>
            <dl className="divide-y divide-border rounded-lg border border-border text-sm">
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-muted-foreground">
                  Refund to client ({cancelResult.refundPct}% per your policy)
                </dt>
                <dd className="font-semibold tabular-nums">{money(cancelResult.refundCents)}</dd>
              </div>
              {cancelResult.securityRefundCents > 0 && (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-muted-foreground">Security deposit refunded in full</dt>
                  <dd className="font-semibold tabular-nums">
                    {money(cancelResult.securityRefundCents)}
                  </dd>
                </div>
              )}
            </dl>
            <DialogFooter>
              <Button onClick={closeDialog}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogDescription>
              The refund follows your cancellation policy automatically, the client is notified by
              email, and the slot frees up right away. This can&apos;t be undone.
            </DialogDescription>
            <div className="mb-4 rounded-xl border border-border bg-background p-4"><p className="font-medium">{data.eventDate} · {data.clientName}</p><p className="mt-1 text-xs text-muted-foreground">{data.eventTime} · {data.spaceName}</p></div>
            <Callout tone="danger" className="mb-4">The slot will be released. This cancellation cannot be undone.</Callout>
            <div className="mb-4" aria-live="polite">
              {cancelPreview.phase === "loading" && (
                <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Working out the refund…
                </div>
              )}
              {cancelPreview.phase === "error" && (
                <Callout tone="warning">
                  We couldn&apos;t preview the refund. It will still follow your cancellation
                  policy.
                </Callout>
              )}
              {cancelPreview.phase === "ready" && (
                <Callout tone="info" title="Refund if you cancel today">
                  {cancelPreview.paidCents > 0 ? (
                    <>
                      Cancelling today refunds {cancelPreview.refundPct}% of{" "}
                      {money(cancelPreview.paidCents)} = <strong>{money(cancelPreview.refundCents)}</strong>
                    </>
                  ) : (
                    <>No booking payments have been made, so there is nothing to refund</>
                  )}
                  {securityHeldCents > 0 ? (
                    <>
                      , plus the full security deposit <strong>{money(securityHeldCents)}</strong>.
                    </>
                  ) : (
                    "."
                  )}
                </Callout>
              )}
            </div>
            {dialogError && (
              <Callout tone="danger" className="mb-4">
                {dialogError}
              </Callout>
            )}
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Client requested to cancel"
              aria-describedby="cancel-reason-hint"
            />
            <FieldHint id="cancel-reason-hint">This is shared with the client.</FieldHint>
            <DialogFooter>
              <Button variant="ghost" onClick={closeDialog}>
                Keep booking
              </Button>
              <Button
                variant="destructive"
                disabled={busy !== null || cancelPreview.phase === "loading"}
                onClick={async () => {
                  setBusy("cancel");
                  setDialogError(null);
                  try {
                    const res = await cancelBookingAction(slug, bookingId, cancelReason.trim());
                    setCancelResult({
                      refundCents: res.refundCents,
                      refundPct: res.refundPct,
                      securityRefundCents: res.securityRefundCents,
                    });
                    toast("Booking cancelled");
                    router.refresh();
                  } catch (err) {
                    setDialogError(errMsg(err));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === "cancel" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {busy === "cancel" ? "Cancelling…" : "Cancel booking"}
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      {/* --------------------------------------------------- No-show */}
      <Dialog open={dialog === "noshow"} onClose={closeDialog}>
        <DialogTitle>Mark as no-show?</DialogTitle>
        <DialogDescription>
          Use this when {data.clientName} didn&apos;t turn up for the event. Nothing is refunded
          automatically, and the booking status changes to &ldquo;No-show&rdquo;.
        </DialogDescription>
        {dialogError && <Callout tone="danger">{dialogError}</Callout>}
        <DialogFooter>
          <Button variant="ghost" onClick={closeDialog}>
            Keep as confirmed
          </Button>
          <Button
            variant="destructive"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("noshow");
              setDialogError(null);
              try {
                await markNoShowAction(slug, bookingId);
                toast("Marked as a no-show");
                closeDialog();
                router.refresh();
              } catch (err) {
                setDialogError(errMsg(err));
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "noshow" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy === "noshow" ? "Saving…" : "Mark no-show"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* -------------------------------------- Security settlement */}
      <Dialog open={dialog === "settle"} onClose={closeDialog} className="max-w-2xl">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          {STATUS_LABELS[status]} booking
        </p>
        <DialogTitle className="text-xl">
          {settleResult ? "Security deposit settled" : "Settle security deposit"}
        </DialogTitle>
        <p className="mb-5 text-sm text-muted-foreground">
          {data.clientName} · {data.eventTypeLabel}
        </p>
        {settleResult ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Refunded" value={money(settleResult.refundCents)} accent />
              <StatTile label="Kept" value={money(settleResult.deductedCents)} accent />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              The client is emailed the refund and deduction details.
            </p>
            <DialogFooter>
              <Button onClick={closeDialog}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite">
              <StatTile label="Held" value={money(securityHeldCents)} />
              <StatTile label="Deductions" value={money(requestedDeductionCents)} />
              <StatTile label="Refunded" value={money(settlePreview.refundCents)} accent />
              <StatTile label="Kept" value={money(settlePreview.deductedCents)} accent />
            </div>

            <Callout tone="info" icon={CircleDollarSign} title="Refund outcome" className="mt-5">
              Client receives {money(settlePreview.refundCents)}; venue keeps{" "}
              {money(settlePreview.deductedCents)}.
              {requestedDeductionCents > securityHeldCents && (
                <> Deductions are capped at the {money(securityHeldCents)} held.</>
              )}
            </Callout>

            {dialogError && (
              <Callout tone="danger" className="mt-4">
                {dialogError}
              </Callout>
            )}

            <fieldset className="mt-6">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <legend className="font-semibold text-foreground">Deductions</legend>
                  <p className="text-sm text-muted-foreground">
                    Add only costs supported by the booking record.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeductions((rows) => [...rows, { reason: "", amount: "" }])}
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add deduction
                </Button>
              </div>
              {deductions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                  No deductions — the full deposit will be refunded.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {deductions.map((d, i) => (
                    <li key={i} className="flex items-center gap-2 px-3 py-3 sm:px-4">
                      <label htmlFor={`ded-reason-${i}`} className="sr-only">
                        Deduction {i + 1} reason
                      </label>
                      <Input
                        id={`ded-reason-${i}`}
                        value={d.reason}
                        onChange={(e) =>
                          setDeductions((rows) =>
                            rows.map((r, j) => (j === i ? { ...r, reason: e.target.value } : r))
                          )
                        }
                        placeholder="e.g. Broken glassware"
                        className="min-w-0 flex-1"
                      />
                      <label htmlFor={`ded-amount-${i}`} className="sr-only">
                        Deduction {i + 1} amount
                      </label>
                      <MoneyInput
                        id={`ded-amount-${i}`}
                        currency={currency}
                        className="w-28 shrink-0"
                        value={d.amount}
                        onChange={(e) =>
                          setDeductions((rows) =>
                            rows.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r))
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove deduction ${i + 1}`}
                        onClick={() => setDeductions((rows) => rows.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              The client is emailed the refund and deduction details.
            </p>

            <DialogFooter className="-mx-6 -mb-6 mt-6 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                disabled={busy !== null}
                onClick={async () => {
                  setBusy("settle");
                  setDialogError(null);
                  try {
                    const clean = deductions
                      .filter((d) => d.reason.trim() || d.amount.trim())
                      .map((d) => ({
                        reason: d.reason.trim() || "Deduction",
                        amountCents: Math.max(0, majorToCents(d.amount) || 0),
                      }));
                    const res = await settleSecurityDepositAction(slug, bookingId, {
                      deductions: clean,
                    });
                    if (!res.ok) {
                      setDialogError(res.error);
                      return;
                    }
                    setSettleResult({ refundCents: res.refundCents, deductedCents: res.deductedCents });
                    toast("Security deposit settled");
                    router.refresh();
                  } catch (err) {
                    setDialogError(errMsg(err));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === "settle" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {busy === "settle" ? "Settling…" : "Refund & settle"}
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      {/* ------------------------------------------ Payment link drawer */}
      <Dialog variant="drawer" open={drawer !== null} onClose={() => setDrawer(null)}>
        {drawer && (
          <PaymentLinkDrawerBody
            drawer={drawer}
            data={data}
            onRetry={() => generateLink(drawer.kind)}
            onClose={() => setDrawer(null)}
          />
        )}
      </Dialog>
    </ActionsContext.Provider>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        accent ? "border-accent bg-accent/60 text-accent-foreground" : "border-border bg-muted/60"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function PaymentLinkDrawerBody({
  drawer,
  data,
  onRetry,
  onClose,
}: {
  drawer: LinkDrawer;
  data: BookingActionsData;
  onRetry: () => void;
  onClose: () => void;
}) {
  const isBalance = drawer.kind === "balance";
  const noun = isBalance ? "Balance" : "Deposit";
  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border px-6 pb-5 pt-6 sm:px-8">
        {drawer.phase === "ready" ? (
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Payment link generated
          </p>
        ) : drawer.phase === "loading" ? (
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Generating link…
          </p>
        ) : (
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
            <AlertCircle className="h-4 w-4" aria-hidden /> Link not created
          </p>
        )}
        <DialogTitle className="text-2xl">
          {drawer.phase === "ready" ? `${noun} payment link ready` : `${noun} payment link`}
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          {data.clientName} · Booking {data.bookingId}
        </p>
      </div>

      <div className="flex-1 space-y-5 px-6 py-6 sm:px-8" aria-live="polite">
        {drawer.phase === "loading" && (
          <div className="space-y-3" aria-busy>
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
            <span className="sr-only">Generating the payment link…</span>
          </div>
        )}

        {drawer.phase === "error" && (
          <div
            role="alert"
            className="flex gap-3 rounded-xl border border-destructive/20 bg-danger-soft p-5"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">Couldn&apos;t generate payment link</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {drawer.error ?? "The payment provider did not respond."} No payment was recorded.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {drawer.phase === "ready" && drawer.url && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {isBalance ? "Balance due" : "Deposit due"}
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                  {formatMoney(drawer.amountCents, data.currency)}
                </p>
                {isBalance && data.securityOutstandingCents > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Includes {formatMoney(data.securityOutstandingCents, data.currency)} refundable
                    security deposit
                  </p>
                )}
              </div>
              <Badge variant="accent" className="px-2.5 py-1 text-[13px]">
                <CheckCircle2 aria-hidden /> Link active
              </Badge>
            </div>

            <div>
              <Label htmlFor="payment-url">Private payment URL</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="payment-url"
                  readOnly
                  value={drawer.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 bg-muted font-mono text-[13px]"
                  aria-describedby="payment-url-hint"
                />
                <CopyButton
                  value={drawer.url}
                  label="Copy link"
                  size="default"
                  toastMessage="Payment link copied"
                />
              </div>
              <FieldHint id="payment-url-hint" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {isBalance
                  ? data.clientEmail
                    ? `Also emailed to ${data.clientEmail}`
                    : "No email on file — share the link yourself"
                  : "Not emailed automatically — share the link with the client yourself"}
              </FieldHint>
            </div>

            <Callout tone="info">
              Generating a payment link does not mark the payment as paid. The{" "}
              {isBalance ? "balance" : "deposit"} remains outstanding until payment is received.
              {!isBalance && " The slot stays penciled while the client pays; payment confirms it."}
            </Callout>

            <div className="grid gap-3 sm:grid-cols-2">
              <CopyButton
                value={drawer.url}
                label="Copy link"
                size="default"
                className="w-full"
                toastMessage="Payment link copied"
              />
              <a
                href={data.manageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants(), "w-full")}
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Open client booking page
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header actions: primary + "More actions" menu (desktop), ⋯ menu (mobile)
// ---------------------------------------------------------------------------

/** Muted note shown when the status has no lifecycle actions. */
export function NoActionsNote({ className }: { className?: string }) {
  const { hasLifecycle, data } = useActions();
  if (hasLifecycle) return null;
  return (
    <p className={cn("rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground", className)}>
      No lifecycle actions for {STATUS_LABELS[data.status].toLowerCase()} bookings
      {data.status === "PENCILED" && data.isPast ? " after the event date" : ""}.
    </p>
  );
}

export function HeaderActions() {
  const { primary, more, busy, hasLifecycle } = useActions();
  if (!hasLifecycle) return <NoActionsNote className="max-w-xs" />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary && (
        <Button onClick={primary.onSelect} disabled={busy !== null || primary.disabled}>
          {busy === primary.key ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <primary.icon className="h-4 w-4" aria-hidden />
          )}
          {primary.label}
        </Button>
      )}
      {more.length > 0 && <MoreMenu items={more} disabled={busy !== null} />}
    </div>
  );
}

/** Mobile header: compact ⋯ menu with every non-primary action. */
export function MobileHeaderMenu() {
  const { more, bar, busy } = useActions();
  const items = mergeItems(more, bar);
  if (items.length === 0) return null;
  return <MoreMenu items={items} disabled={busy !== null} iconOnly />;
}

function mergeItems(a: ActionItem[], b: ActionItem[]): ActionItem[] {
  const seen = new Set<string>();
  return [...a, ...b].filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)));
}

function MoreMenu({
  items,
  disabled,
  iconOnly,
  placement = "bottom",
  className,
}: {
  items: ActionItem[];
  disabled: boolean;
  iconOnly?: boolean;
  placement?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  const focusables = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []
    );

  React.useEffect(() => {
    if (!open) return;
    focusables()[0]?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = focusables();
    const idx = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(idx + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(idx - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={iconOnly ? "More actions" : undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          buttonVariants({ variant: "outline", size: iconOnly ? "icon" : "default" }),
          !iconOnly && "w-full",
          placement === "top" && "h-11"
        )}
      >
        {!iconOnly && (placement === "top" ? "More" : "More actions")}
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="More actions"
          onKeyDown={onKeyDown}
          className={cn(
            "absolute right-0 z-40 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-1.5 shadow-lg",
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex min-h-10 w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
                item.tone === "destructive" ? "text-destructive" : "text-foreground"
              )}
            >
              <item.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {item.label}
                {item.hint && (
                  <span className="block text-xs text-muted-foreground">{item.hint}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sticky bottom action bar
//  - desktop (md+): the admin / destructive actions valid for the status
//  - mobile: the primary action + a "More ⋯" menu with everything else
// ---------------------------------------------------------------------------

export function ActionBar() {
  const { primary, more, bar, busy } = useActions();
  const mobileMore = mergeItems(more, bar);
  const showDesktop = bar.length > 0;
  const showMobile = primary !== null || mobileMore.length > 0;
  if (!showDesktop && !showMobile) return null;

  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 -mb-6 mt-8 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:-mb-10",
        !showDesktop && "md:hidden",
        !showMobile && "max-md:hidden"
      )}
    >
      {/* Mobile */}
      <div className="flex items-center gap-2 md:hidden">
        {primary && (
          <Button
            onClick={primary.onSelect}
            disabled={busy !== null || primary.disabled}
            className="h-11 min-w-0 flex-1"
          >
            {busy === primary.key ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <primary.icon className="h-4 w-4" aria-hidden />
            )}
            <span className="truncate">{primary.label}</span>
          </Button>
        )}
        {mobileMore.length > 0 && (
          <MoreMenu
            items={mobileMore}
            disabled={busy !== null}
            placement="top"
            className={primary ? "shrink-0" : "flex-1"}
          />
        )}
      </div>

      {/* Desktop */}
      {showDesktop && (
        <div className="hidden flex-wrap items-center justify-end gap-2 md:flex">
          <p className="mr-auto text-sm text-muted-foreground">
            Each of these asks you to confirm first.
          </p>
          {bar.map((item) => (
            <Button
              key={item.key}
              variant={item.tone === "destructive" ? "destructive-outline" : "outline"}
              disabled={busy !== null || item.disabled}
              onClick={item.onSelect}
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
