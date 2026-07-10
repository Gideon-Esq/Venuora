// Stripe Connect (Standard) + Stripe Billing.
// Money flows: booking deposit → balance → refundable security deposit →
// refunds per cancellation tier. Platform takes an application fee
// (PLATFORM_FEE_BPS) on online payments; webhooks drive all state.
//
// DEV MODE: with placeholder keys, payment sessions are simulated so the
// whole product can be demoed without a Stripe account.

import Stripe from "stripe";
import { applyBps } from "./money";

export function isStripeConfigured(): boolean {
  const k = process.env.STRIPE_SECRET_KEY;
  return !!k && !k.includes("placeholder");
}

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");
  }
  return _stripe;
}

export function platformFeeBps(): number {
  return Number(process.env.PLATFORM_FEE_BPS ?? 300);
}

export const PLAN_PRICES: Record<string, { priceEnv: string; label: string; spaces: number }> = {
  SOLO: { priceEnv: "STRIPE_PRICE_SOLO", label: "$49/mo — 1 space", spaces: 1 },
  GROWTH: { priceEnv: "STRIPE_PRICE_GROWTH", label: "$99/mo — up to 5 spaces", spaces: 5 },
  PRO: { priceEnv: "STRIPE_PRICE_PRO", label: "$199/mo — up to 10 spaces", spaces: 10 },
};

export const PLAN_SPACE_LIMITS: Record<string, number> = {
  TRIAL: 10,
  SOLO: 1,
  GROWTH: 5,
  PRO: 10,
};

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Connect onboarding
// ---------------------------------------------------------------------------

export async function createConnectAccount(venue: {
  id: string;
  name: string;
  email: string | null;
}): Promise<string> {
  if (!isStripeConfigured()) return `acct_dev_${venue.id}`;
  const account = await getStripe().accounts.create({
    type: "standard",
    email: venue.email ?? undefined,
    metadata: { venueId: venue.id },
  });
  return account.id;
}

export async function createConnectOnboardingLink(
  accountId: string,
  venueSlug: string
): Promise<string> {
  if (!isStripeConfigured()) {
    // Dev: pretend onboarding completed.
    return `${appUrl()}/app/${venueSlug}/settings/payments?dev_onboarded=1`;
  }
  const link = await getStripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl()}/app/${venueSlug}/settings/payments?refresh=1`,
    return_url: `${appUrl()}/app/${venueSlug}/settings/payments?connected=1`,
  });
  return link.url;
}

// ---------------------------------------------------------------------------
// Client payments (deposit / balance / security deposit)
// ---------------------------------------------------------------------------

export interface PaymentSessionArgs {
  bookingId: string;
  paymentId: string; // our Payment row (PENDING) — webhook flips it
  venueStripeAccountId: string | null;
  amountCents: number;
  currency: string;
  description: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  collectApplicationFee: boolean;
}

export type PaymentSession =
  | { mode: "stripe"; url: string; sessionId: string }
  | { mode: "dev"; url: string; sessionId: string };

/**
 * Hosted Checkout on the venue's connected account with our application fee.
 * In dev mode returns a simulated-payment URL that marks the payment
 * succeeded via the same code path the webhook uses.
 */
export async function createPaymentSession(args: PaymentSessionArgs): Promise<PaymentSession> {
  if (!isStripeConfigured() || !args.venueStripeAccountId || args.venueStripeAccountId.startsWith("acct_dev")) {
    const sessionId = `cs_dev_${args.paymentId}`;
    return {
      mode: "dev",
      sessionId,
      url: `${appUrl()}/api/dev/simulate-payment?payment=${args.paymentId}&redirect=${encodeURIComponent(args.successUrl)}`,
    };
  }
  const fee = args.collectApplicationFee ? applyBps(args.amountCents, platformFeeBps()) : 0;
  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      customer_email: args.customerEmail ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: args.currency,
            unit_amount: args.amountCents,
            product_data: { name: args.description },
          },
        },
      ],
      payment_intent_data: fee > 0 ? { application_fee_amount: fee } : undefined,
      metadata: { bookingId: args.bookingId, paymentId: args.paymentId },
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    },
    { stripeAccount: args.venueStripeAccountId }
  );
  return { mode: "stripe", url: session.url!, sessionId: session.id };
}

/** Refund a succeeded payment (full or partial) on the connected account. */
export async function refundStripePayment(args: {
  venueStripeAccountId: string | null;
  paymentIntentId: string | null;
  amountCents: number;
}): Promise<string> {
  if (
    !isStripeConfigured() ||
    !args.venueStripeAccountId ||
    args.venueStripeAccountId.startsWith("acct_dev") ||
    !args.paymentIntentId ||
    args.paymentIntentId.startsWith("pi_dev")
  ) {
    return `re_dev_${Date.now().toString(36)}`;
  }
  const refund = await getStripe().refunds.create(
    { payment_intent: args.paymentIntentId, amount: args.amountCents },
    { stripeAccount: args.venueStripeAccountId }
  );
  return refund.id;
}

// ---------------------------------------------------------------------------
// SaaS subscription (platform account)
// ---------------------------------------------------------------------------

export async function createSubscriptionCheckout(args: {
  venueId: string;
  venueSlug: string;
  tier: "SOLO" | "GROWTH" | "PRO";
  customerEmail: string;
}): Promise<string> {
  if (!isStripeConfigured()) {
    return `${appUrl()}/app/${args.venueSlug}/settings/billing?dev_subscribed=${args.tier}`;
  }
  const price = process.env[PLAN_PRICES[args.tier].priceEnv];
  if (!price) throw new Error(`Missing price id for ${args.tier}`);
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: args.customerEmail,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { trial_period_days: 30, metadata: { venueId: args.venueId } },
    metadata: { venueId: args.venueId, tier: args.tier },
    success_url: `${appUrl()}/app/${args.venueSlug}/settings/billing?subscribed=1`,
    cancel_url: `${appUrl()}/app/${args.venueSlug}/settings/billing`,
  });
  return session.url!;
}
