// Line-item price table shared by the booking flow review step, the manage
// page and the quote page. Pure display — takes an immutable snapshot.

import { formatMoney } from "@/lib/money";
import type { LineItem } from "@/lib/pricing";

export function PriceBreakdown({
  lineItems,
  subtotalCents,
  taxCents,
  totalCents,
  currency,
}: {
  lineItems: LineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
}) {
  return (
    <div className="text-sm">
      <ul className="divide-y divide-zinc-100">
        {lineItems.map((li, i) => (
          <li key={i} className="flex items-baseline justify-between gap-4 py-2">
            <span className="text-zinc-700">{li.label}</span>
            <span className="whitespace-nowrap font-medium text-zinc-900">
              {formatMoney(li.totalCents, currency)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 space-y-1.5 border-t border-zinc-200 pt-3">
        <Row label="Subtotal" value={formatMoney(subtotalCents, currency)} />
        {taxCents > 0 && <Row label="Tax" value={formatMoney(taxCents, currency)} />}
        <div className="flex items-baseline justify-between pt-1 text-base">
          <span className="font-semibold text-zinc-900">Total</span>
          <span className="font-semibold text-zinc-900">
            {formatMoney(totalCents, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-zinc-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
