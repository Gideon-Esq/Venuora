// Stripe webhook — the ONLY writer of payment success/failure state.
// Idempotent via the WebhookEvent ledger; never trusts client redirects.

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { markPaymentFailed, markPaymentSucceeded } from "@/lib/payments";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: first writer wins, replays are no-ops.
  try {
    await db.webhookEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId;
      if (paymentId && session.payment_status === "paid") {
        await markPaymentSucceeded(paymentId, {
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
        });
      }
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId;
      if (paymentId) await markPaymentFailed(paymentId);
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const payment = await db.payment.findFirst({
        where: { stripePaymentIntentId: intent.id },
      });
      if (payment) await markPaymentFailed(payment.id);
      break;
    }
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const venueId = account.metadata?.venueId;
      if (venueId) {
        await db.venue.updateMany({
          where: { id: venueId },
          data: { stripeChargesEnabled: !!account.charges_enabled },
        });
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const venueId = sub.metadata?.venueId;
      if (venueId) {
        await db.venue.updateMany({
          where: { id: venueId },
          data: {
            stripeSubscriptionId: sub.id,
            trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          },
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const venueId = sub.metadata?.venueId;
      if (venueId) {
        await db.venue.updateMany({
          where: { id: venueId },
          data: { planTier: "TRIAL", stripeSubscriptionId: null },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
