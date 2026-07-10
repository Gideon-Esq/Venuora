"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
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

export function PoliciesForm({ slug, initial }: { slug: string; initial: PoliciesInitial }) {
  const router = useRouter();
  const [depositPct, setDepositPct] = React.useState(String(initial.depositPct));
  const [balanceDueDays, setBalanceDueDays] = React.useState(String(initial.balanceDueDays));
  const [securityDeposit, setSecurityDeposit] = React.useState(
    (initial.securityDepositCents / 100).toFixed(initial.securityDepositCents % 100 === 0 ? 0 : 2)
  );
  const [autoCharge, setAutoCharge] = React.useState(initial.autoChargeBalance);
  const [taxPct, setTaxPct] = React.useState(String(initial.taxBps / 100));
  const [houseRules, setHouseRules] = React.useState(initial.houseRules);
  const [tiers, setTiers] = React.useState(
    initial.cancellationTiers.map((t) => ({
      minDaysBefore: String(t.minDaysBefore),
      refundPct: String(t.refundPct),
    }))
  );
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const parsedTiers = tiers.map((t) => ({
      minDaysBefore: Number.parseInt(t.minDaysBefore, 10) || 0,
      refundPct: Number.parseInt(t.refundPct, 10) || 0,
    }));
    if (!parsedTiers.some((t) => t.minDaysBefore === 0)) {
      setMessage({
        ok: false,
        text: "Include a “0+ days” row so every cancellation has a rule — even a last-minute one (it can be 0% refund).",
      });
      return;
    }
    setSaving(true);
    const res = await updatePoliciesAction(slug, {
      depositPct: Number.parseInt(depositPct, 10) || 0,
      balanceDueDays: Number.parseInt(balanceDueDays, 10) || 0,
      securityDepositCents: Math.round((Number.parseFloat(securityDeposit) || 0) * 100),
      autoChargeBalance: autoCharge,
      taxBps: Math.round((Number.parseFloat(taxPct) || 0) * 100),
      houseRules: houseRules.trim(),
      cancellationTiers: parsedTiers,
    });
    setSaving(false);
    if (res.ok) {
      setMessage({ ok: true, text: "Policies saved." });
      router.refresh();
    } else {
      setMessage({ ok: false, text: res.error });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {message && (
        <p
          className={
            message.ok
              ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
          }
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="pol-deposit">Deposit</Label>
          <div className="relative">
            <Input
              id="pol-deposit"
              type="number"
              min={0}
              max={100}
              value={depositPct}
              onChange={(e) => setDepositPct(e.target.value)}
              className="pr-8"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              %
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Paid up front to confirm a booking.</p>
        </div>
        <div>
          <Label htmlFor="pol-due">Balance due</Label>
          <div className="relative">
            <Input
              id="pol-due"
              type="number"
              min={0}
              max={365}
              value={balanceDueDays}
              onChange={(e) => setBalanceDueDays(e.target.value)}
              className="pr-24"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              days before
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">When the rest of the money is due.</p>
        </div>
        <div>
          <Label htmlFor="pol-security">Security deposit</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              $
            </span>
            <Input
              id="pol-security"
              type="number"
              min="0"
              step="0.01"
              value={securityDeposit}
              onChange={(e) => setSecurityDeposit(e.target.value)}
              className="pl-7"
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Refundable damage deposit, collected with the balance. Set $0 to skip.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3">
        <input
          type="checkbox"
          checked={autoCharge}
          onChange={(e) => setAutoCharge(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-indigo-600"
        />
        <span>
          <span className="block text-sm font-medium text-zinc-900">
            {autoCharge ? "Auto-charge balance when due" : "Send payment link reminders"}
          </span>
          <span className="block text-xs text-zinc-500">
            {autoCharge
              ? "We automatically charge the client's card on the due date."
              : "We email the client payment-link reminders before the due date; they pay themselves."}
          </span>
        </span>
      </label>

      <div className="max-w-48">
        <Label htmlFor="pol-tax">Tax rate</Label>
        <div className="relative">
          <Input
            id="pol-tax"
            type="number"
            min="0"
            max="30"
            step="0.01"
            value={taxPct}
            onChange={(e) => setTaxPct(e.target.value)}
            className="pr-8"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
            %
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Added to every quote and booking. Set 0 if not applicable.</p>
      </div>

      <div>
        <Label htmlFor="pol-rules">House rules</Label>
        <Textarea
          id="pol-rules"
          value={houseRules}
          onChange={(e) => setHouseRules(e.target.value)}
          placeholder="e.g. Music off by 11pm. No confetti or open flames. Parking in the rear lot only."
          className="min-h-28"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Shared with clients on their booking page and in the event-week email.
        </p>
      </div>

      <div>
        <Label>Cancellation policy</Label>
        <p className="mb-2 text-xs text-zinc-500">
          How much clients get back when they cancel, based on notice given. The security
          deposit is always refunded in full on cancellation.
        </p>
        <div className="space-y-2">
          {tiers.map((t, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
              <div className="relative w-28">
                <Input
                  type="number"
                  min={0}
                  max={730}
                  value={t.minDaysBefore}
                  onChange={(e) =>
                    setTiers((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, minDaysBefore: e.target.value } : r))
                    )
                  }
                  aria-label="Days before event"
                />
              </div>
              <span>+ days before</span>
              <span className="text-zinc-400">→</span>
              <div className="relative w-24">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={t.refundPct}
                  onChange={(e) =>
                    setTiers((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, refundPct: e.target.value } : r))
                    )
                  }
                  className="pr-7"
                  aria-label="Refund percentage"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                  %
                </span>
              </div>
              <span>refund</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove tier"
                onClick={() => setTiers((rows) => rows.filter((_, j) => j !== i))}
                disabled={tiers.length <= 1}
              >
                <Trash2 className="h-4 w-4 text-zinc-500" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={tiers.length >= 6}
            onClick={() => setTiers((rows) => [...rows, { minDaysBefore: "0", refundPct: "0" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Add tier
          </Button>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Example: 60+ days → 100%, 30+ days → 50%, 0+ days → 0%.
        </p>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save policies"}
      </Button>
    </form>
  );
}
