"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Eye, Info, Mail, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cancellationSentences } from "@/components/public/policy-summary";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { updatePoliciesAction } from "@/actions/venue";

export interface PoliciesInitial {
  depositPct: number;
  balanceDueDays: number;
  securityDepositCents: number;
  autoChargeBalance: boolean;
  taxBps: number;
  houseRules: string;
  cancellationTiers: { minDaysBefore: number; refundPct: number }[];
}

const PRESETS = [100, 75, 50, 25, 0];
const MAX_TIERS = 6;

interface TierRow {
  id: number;
  days: string;
  refund: string;
  custom: boolean;
}

interface FormState {
  depositPct: string;
  balanceDueDays: string;
  securityDeposit: string;
  taxPct: string;
  houseRules: string;
  tiers: TierRow[];
}

function toState(initial: PoliciesInitial): FormState {
  return {
    depositPct: String(initial.depositPct),
    balanceDueDays: String(initial.balanceDueDays),
    securityDeposit: (initial.securityDepositCents / 100).toFixed(
      initial.securityDepositCents % 100 === 0 ? 0 : 2
    ),
    taxPct: String(initial.taxBps / 100),
    houseRules: initial.houseRules,
    tiers: initial.cancellationTiers.map((t, i) => ({
      id: i,
      days: String(t.minDaysBefore),
      refund: String(t.refundPct),
      custom: !PRESETS.includes(t.refundPct),
    })),
  };
}

function snapshot(s: FormState) {
  return JSON.stringify({ ...s, tiers: s.tiers.map((t) => [t.days, t.refund]) });
}

const intOrNull = (v: string) => (/^\d+$/.test(v.trim()) ? Number.parseInt(v, 10) : null);

interface TierCheck {
  rowErrors: Record<number, string>;
  formErrors: string[];
  parsed: { minDaysBefore: number; refundPct: number }[];
}

function checkTiers(tiers: TierRow[]): TierCheck {
  const rowErrors: Record<number, string> = {};
  const formErrors: string[] = [];
  const parsed: { minDaysBefore: number; refundPct: number }[] = [];
  const seen = new Map<number, number>();

  for (const t of tiers) {
    const days = intOrNull(t.days);
    const refund = intOrNull(t.refund);
    if (days === null || days > 730) {
      rowErrors[t.id] = "Enter a whole number of days between 0 and 730.";
      continue;
    }
    if (refund === null || refund > 100) {
      rowErrors[t.id] = "Refund must be between 0% and 100%.";
      continue;
    }
    if (seen.has(days)) {
      rowErrors[t.id] = `Another tier already starts at ${days}+ days. Each tier needs its own number of days.`;
      continue;
    }
    seen.set(days, t.id);
    parsed.push({ minDaysBefore: days, refundPct: refund });
  }

  if (tiers.length === 0) {
    formErrors.push("Add at least one cancellation tier.");
  } else if (!tiers.some((t) => intOrNull(t.days) === 0)) {
    formErrors.push(
      "Include a “0+ days” tier so every cancellation has a rule — even a last-minute one (it can be 0% refund)."
    );
  }
  return { rowErrors, formErrors, parsed };
}

export function PoliciesForm({
  slug,
  venueName,
  currency,
  initial,
}: {
  slug: string;
  venueName: string;
  currency: string;
  initial: PoliciesInitial;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = React.useState<FormState>(() => toState(initial));
  const [v, setV] = React.useState<FormState>(() => toState(initial));
  const [nextId, setNextId] = React.useState(initial.cancellationTiers.length);
  const [showErrors, setShowErrors] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [justSaved, setJustSaved] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const dirty = snapshot(v) !== snapshot(saved);
  const currencySymbol = formatMoney(0, currency).replace(/[\d.,\s]/g, "") || currency.toUpperCase();

  const depositPct = intOrNull(v.depositPct);
  const balanceDueDays = intOrNull(v.balanceDueDays);
  const securityNum = Number.parseFloat(v.securityDeposit);
  const securityCents = Number.isFinite(securityNum) && securityNum >= 0 ? Math.round(securityNum * 100) : null;
  const taxNum = Number.parseFloat(v.taxPct);
  const taxBps = Number.isFinite(taxNum) && taxNum >= 0 ? Math.round(taxNum * 100) : null;

  const fieldErrors: Partial<Record<"depositPct" | "balanceDueDays" | "securityDeposit" | "taxPct", string>> = {};
  if (depositPct === null || depositPct > 100) fieldErrors.depositPct = "Enter a whole percentage from 0 to 100.";
  if (balanceDueDays === null || balanceDueDays > 365) fieldErrors.balanceDueDays = "Enter 0 to 365 days.";
  if (securityCents === null) fieldErrors.securityDeposit = "Enter an amount of 0 or more.";
  if (taxBps === null || taxBps > 3000) fieldErrors.taxPct = "Enter a rate from 0 to 30%.";

  const tierCheck = checkTiers(v.tiers);
  const hasErrors =
    Object.keys(fieldErrors).length > 0 ||
    Object.keys(tierCheck.rowErrors).length > 0 ||
    tierCheck.formErrors.length > 0;
  // Tier problems show live (they are easy to create while editing); field errors once a save is attempted.
  const showField = (k: keyof typeof fieldErrors) => (showErrors ? fieldErrors[k] : undefined);

  function update(patch: Partial<FormState>) {
    setV((s) => ({ ...s, ...patch }));
    setJustSaved(false);
  }

  function updateTier(id: number, patch: Partial<TierRow>) {
    setV((s) => ({ ...s, tiers: s.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    setJustSaved(false);
  }

  function moveTier(index: number, dir: -1 | 1) {
    setV((s) => {
      const tiers = [...s.tiers];
      const j = index + dir;
      if (j < 0 || j >= tiers.length) return s;
      [tiers[index], tiers[j]] = [tiers[j], tiers[index]];
      return { ...s, tiers };
    });
  }

  function addTier() {
    const used = new Set(v.tiers.map((t) => intOrNull(t.days)));
    const days = used.has(0) ? "" : "0";
    setV((s) => ({ ...s, tiers: [...s.tiers, { id: nextId, days, refund: "0", custom: false }] }));
    setNextId((n) => n + 1);
    setJustSaved(false);
  }

  function discard() {
    setV(saved);
    setShowErrors(false);
    setFormError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (hasErrors) {
      setShowErrors(true);
      setFormError("Please fix the highlighted fields before saving.");
      return;
    }
    const snapshotAtSave = v;
    startTransition(async () => {
      const res = await updatePoliciesAction(slug, {
        depositPct: depositPct ?? 0,
        balanceDueDays: balanceDueDays ?? 0,
        securityDepositCents: securityCents ?? 0,
        // Auto-charge isn't offered in the UI; send the stored value unchanged.
        autoChargeBalance: initial.autoChargeBalance,
        taxBps: taxBps ?? 0,
        houseRules: snapshotAtSave.houseRules.trim(),
        cancellationTiers: tierCheck.parsed,
      });
      if (res.ok) {
        setSaved(snapshotAtSave);
        setShowErrors(false);
        setJustSaved(true);
        toast("Policies saved");
        router.refresh();
      } else {
        setFormError(res.error);
        toast(res.error, "error");
      }
    });
  }

  const previewSentences = cancellationSentences(tierCheck.parsed);

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {formError && <Callout tone="danger">{formError}</Callout>}

      <Card>
        <CardHeader>
          <CardTitle>Payment schedule</CardTitle>
          <CardDescription>Choose what clients pay and when the remaining balance is due.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <PolicyRow
            id="pol-deposit"
            label="Deposit"
            hint="What clients pay up front to confirm a booking."
            error={showField("depositPct")}
          >
            <AffixInput
              id="pol-deposit"
              suffix="%"
              min={0}
              max={100}
              value={v.depositPct}
              onChange={(x) => update({ depositPct: x })}
              invalid={!!showField("depositPct")}
            />
          </PolicyRow>
          <PolicyRow
            id="pol-due"
            label="Balance due"
            hint="How many days before the event the remaining balance is due."
            error={showField("balanceDueDays")}
          >
            <AffixInput
              id="pol-due"
              suffix="days"
              min={0}
              max={365}
              value={v.balanceDueDays}
              onChange={(x) => update({ balanceDueDays: x })}
              invalid={!!showField("balanceDueDays")}
            />
          </PolicyRow>
          <PolicyRow
            id="pol-security"
            label="Security deposit"
            hint="Refundable damage deposit, collected with the balance. Set 0 to skip."
            error={showField("securityDeposit")}
          >
            <AffixInput
              id="pol-security"
              prefix={currencySymbol}
              min={0}
              step="0.01"
              value={v.securityDeposit}
              onChange={(x) => update({ securityDeposit: x })}
              invalid={!!showField("securityDeposit")}
            />
          </PolicyRow>
          <PolicyRow
            id="pol-tax"
            label="Tax rate"
            hint="Added to every quote and booking. Set 0 if not applicable."
            error={showField("taxPct")}
          >
            <AffixInput
              id="pol-tax"
              suffix="%"
              min={0}
              max={30}
              step="0.01"
              value={v.taxPct}
              onChange={(x) => update({ taxPct: x })}
              invalid={!!showField("taxPct")}
            />
          </PolicyRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Balance reminders</CardTitle>
          <CardDescription>Clients pay the balance themselves from a secure payment link.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="flex items-start gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            Venuora emails a payment-link reminder 14 and 3 days before the balance is due.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <label htmlFor="pol-rules">House rules</label>
          </CardTitle>
          <CardDescription>Shared with clients on their quote, booking page and event-week email.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="pol-rules"
            value={v.houseRules}
            onChange={(e) => update({ houseRules: e.target.value })}
            maxLength={4000}
            placeholder="e.g. Music off by 11pm. No confetti or open flames. Parking in the rear lot only."
            className="min-h-28"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cancellation policy</CardTitle>
          <CardDescription>
            Set the refund clients receive based on how far in advance they cancel. The security
            deposit is always refunded in full on cancellation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="space-y-3" aria-label="Cancellation tiers">
            {v.tiers.map((t, i) => {
              const rowError = tierCheck.rowErrors[t.id];
              const refundSelect = t.custom ? "custom" : t.refund;
              return (
                <li
                  key={t.id}
                  className={cn(
                    "rounded-lg border bg-card p-4",
                    rowError ? "border-destructive/50" : "border-border"
                  )}
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-32">
                      <Label htmlFor={`tier-days-${t.id}`}>Days before event</Label>
                      <div className="relative">
                        <Input
                          id={`tier-days-${t.id}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={730}
                          value={t.days}
                          onChange={(e) => updateTier(t.id, { days: e.target.value })}
                          className="pr-14 text-right"
                          aria-invalid={rowError ? true : undefined}
                          aria-describedby={rowError ? `tier-err-${t.id}` : undefined}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          + days
                        </span>
                      </div>
                    </div>
                    <div className="w-36">
                      <Label htmlFor={`tier-refund-${t.id}`}>Refund</Label>
                      <Select
                        id={`tier-refund-${t.id}`}
                        value={refundSelect}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "custom") updateTier(t.id, { custom: true });
                          else updateTier(t.id, { custom: false, refund: val });
                        }}
                      >
                        {PRESETS.map((p) => (
                          <option key={p} value={String(p)}>
                            {p === 0 ? "No refund" : `${p}% refund`}
                          </option>
                        ))}
                        <option value="custom">Custom…</option>
                      </Select>
                    </div>
                    {t.custom && (
                      <div className="w-24">
                        <Label htmlFor={`tier-custom-${t.id}`}>Custom %</Label>
                        <div className="relative">
                          <Input
                            id={`tier-custom-${t.id}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            value={t.refund}
                            onChange={(e) => updateTier(t.id, { refund: e.target.value })}
                            className="pr-7 text-right"
                            aria-invalid={rowError ? true : undefined}
                          />
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move tier ${i + 1} up`}
                        disabled={i === 0}
                        onClick={() => moveTier(i, -1)}
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move tier ${i + 1} down`}
                        disabled={i === v.tiers.length - 1}
                        onClick={() => moveTier(i, 1)}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete tier ${i + 1}`}
                        disabled={v.tiers.length <= 1}
                        onClick={() => {
                          setV((s) => ({ ...s, tiers: s.tiers.filter((r) => r.id !== t.id) }));
                          setJustSaved(false);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  {rowError && (
                    <FieldHint id={`tier-err-${t.id}`} error>
                      {rowError}
                    </FieldHint>
                  )}
                </li>
              );
            })}
          </ol>

          {tierCheck.formErrors.map((msg) => (
            <Callout key={msg} tone="danger">
              {msg}
            </Callout>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addTier}
            disabled={v.tiers.length >= MAX_TIERS}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add cancellation tier
          </Button>
          <FieldHint>
            Up to {MAX_TIERS} tiers. Example: 60+ days → full refund, 30+ days → 50%, 0+ days → no refund.
          </FieldHint>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Client preview</p>
            <CardDescription className="mt-1">
              This is how your policies appear before a client books.
            </CardDescription>
          </div>
          <Eye className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Booking policies</h3>
            <p className="text-sm text-muted-foreground">{venueName}</p>
          </div>
          <dl className="divide-y divide-border border-y border-border text-sm">
            <div className="flex flex-wrap justify-between gap-2 py-2.5">
              <dt className="text-muted-foreground">Deposit</dt>
              <dd className="font-medium text-foreground">
                {depositPct !== null && depositPct <= 100 ? `${depositPct}% to confirm` : "—"}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-2.5">
              <dt className="text-muted-foreground">Remaining balance</dt>
              <dd className="font-medium text-foreground">
                {balanceDueDays === null
                  ? "—"
                  : balanceDueDays === 0
                    ? "Due on the day of the event"
                    : `Due ${balanceDueDays} day${balanceDueDays === 1 ? "" : "s"} before the event`}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-2.5">
              <dt className="text-muted-foreground">Security deposit</dt>
              <dd className="font-medium text-foreground">
                {securityCents === null
                  ? "—"
                  : securityCents === 0
                    ? "None"
                    : `${formatMoney(securityCents, currency)}, refundable`}
              </dd>
            </div>
          </dl>
          <div className="rounded-lg bg-muted px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Cancellations</p>
            {previewSentences.length > 0 ? (
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-6 text-foreground">
                {previewSentences.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">Add a cancellation tier to see the rules.</p>
            )}
          </div>
          <Callout tone="info" icon={Info}>
            Changes apply to new bookings. Cancellation refunds use the policy in effect when the
            booking is cancelled.
          </Callout>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:shadow-lg">
        <span className="mr-auto inline-flex items-center gap-2 text-sm font-medium" role="status">
          {dirty ? (
            <>
              <span className="h-2 w-2 rounded-full bg-warning" aria-hidden />
              Unsaved changes
            </>
          ) : justSaved ? (
            <>
              <Check className="h-4 w-4 text-success" aria-hidden />
              <span className="text-success">Saved</span>
            </>
          ) : (
            <span className="text-muted-foreground">All changes saved</span>
          )}
        </span>
        <Button type="button" variant="outline" onClick={discard} disabled={!dirty || pending}>
          Discard changes
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save policies"}
        </Button>
      </div>
    </form>
  );
}

function PolicyRow({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
        {error && (
          <FieldHint id={`${id}-error`} error>
            {error}
          </FieldHint>
        )}
      </div>
      <div className="w-full shrink-0 sm:w-40">{children}</div>
    </div>
  );
}

function AffixInput({
  id,
  prefix,
  suffix,
  value,
  onChange,
  invalid,
  min,
  max,
  step,
}: {
  id: string;
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        id={id}
        type="number"
        inputMode={step ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("text-right", prefix && "pl-8", suffix && (suffix.length > 1 ? "pr-14" : "pr-8"))}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? `${id}-hint ${id}-error` : `${id}-hint`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}
