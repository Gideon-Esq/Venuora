// All money is integer cents. Never floats, never recompute history.

export function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Round half away from zero — deterministic for money math. */
export function roundCents(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Apply a percentage expressed in basis points (300 = 3%). */
export function applyBps(cents: number, bps: number): number {
  return roundCents((cents * bps) / 10_000);
}

/** Apply a percentage expressed as a whole-number pct (30 = 30%). */
export function applyPct(cents: number, pct: number): number {
  return roundCents((cents * pct) / 100);
}
