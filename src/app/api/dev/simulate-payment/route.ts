// DEV ONLY — stands in for Stripe Checkout + webhook when no Stripe keys
// are configured, so the full booking flow is demoable locally. Uses the
// same markPaymentSucceeded path the real webhook uses.

import { NextRequest, NextResponse } from "next/server";
import { markPaymentSucceeded } from "@/lib/payments";
import { isStripeConfigured } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  if (isStripeConfigured()) {
    return NextResponse.json({ error: "Disabled when Stripe is configured" }, { status: 403 });
  }
  const paymentId = req.nextUrl.searchParams.get("payment");
  const redirect = req.nextUrl.searchParams.get("redirect") ?? "/";
  if (!paymentId) return NextResponse.json({ error: "Missing payment" }, { status: 400 });

  await markPaymentSucceeded(paymentId, { paymentIntentId: `pi_dev_${paymentId}` });
  return NextResponse.redirect(redirect);
}
