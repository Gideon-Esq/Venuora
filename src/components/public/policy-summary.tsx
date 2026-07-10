// Renders a venue's payment & cancellation policies as plain sentences —
// clients should never have to decode a tier table.

import { formatMoney } from "@/lib/money";
import type { CancellationTier } from "@/lib/pricing";

export function cancellationSentences(tiers: CancellationTier[]): string[] {
  const sorted = [...tiers].sort((a, b) => b.minDaysBefore - a.minDaysBefore);
  return sorted.map((tier, i) => {
    const upper = i > 0 ? sorted[i - 1].minDaysBefore - 1 : null;
    const range =
      upper == null
        ? `${tier.minDaysBefore}+ days before the event`
        : tier.minDaysBefore === 0
          ? upper <= 0
            ? "on the day of the event"
            : `less than ${upper + 1} days before the event`
          : `${tier.minDaysBefore}–${upper} days before the event`;
    const refund =
      tier.refundPct === 0
        ? "no refund"
        : tier.refundPct === 100
          ? "full refund of what you've paid"
          : `${tier.refundPct}% refund of what you've paid`;
    return `Cancel ${range}: ${refund}.`;
  });
}

export function PolicySummary({
  depositPct,
  balanceDueDays,
  securityDepositCents,
  currency,
  cancellationTiers,
}: {
  depositPct: number;
  balanceDueDays: number;
  securityDepositCents: number;
  currency: string;
  cancellationTiers: CancellationTier[];
}) {
  return (
    <div className="space-y-4 text-sm leading-6 text-zinc-700">
      <div>
        <h4 className="font-medium text-zinc-900">Payments</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            A {depositPct}% deposit confirms your booking; the balance is due{" "}
            {balanceDueDays === 0
              ? "on the day of the event"
              : `${balanceDueDays} days before the event`}
            .
          </li>
          {securityDepositCents > 0 && (
            <li>
              A refundable security deposit of{" "}
              {formatMoney(securityDepositCents, currency)} is collected with the balance and
              returned after the event, less any agreed deductions.
            </li>
          )}
        </ul>
      </div>
      <div>
        <h4 className="font-medium text-zinc-900">Cancellations</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {cancellationSentences(cancellationTiers).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
