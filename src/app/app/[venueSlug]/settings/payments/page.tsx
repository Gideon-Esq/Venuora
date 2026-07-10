import { CheckCircle2, CircleDashed, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { connectStripeAction } from "@/actions/venue";
import { requireVenue } from "@/lib/tenancy";
import { DevOnboardedHandler } from "./dev-onboarded";

export default async function PaymentsSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ dev_onboarded?: string }>;
}) {
  const { venueSlug } = await params;
  const sp = await searchParams;
  const { venue } = await requireVenue(venueSlug, "OWNER");

  const connectAction = connectStripeAction.bind(null, venueSlug);
  const showDevHandler = sp.dev_onboarded === "1" && !venue.stripeChargesEnabled;

  return (
    <div className="space-y-4">
      {showDevHandler && <DevOnboardedHandler slug={venueSlug} />}

      <Card>
        <CardHeader>
          <CardTitle>Online payments</CardTitle>
          <CardDescription>
            Powered by Stripe. Money goes straight to your bank account — Venuora never holds
            your funds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {venue.stripeChargesEnabled ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-medium text-emerald-900">Connected — you can take payments</p>
                <p className="text-sm text-emerald-800">
                  Deposit and balance links, and instant-book checkout, all work.
                </p>
                {venue.stripeAccountId && (
                  <p className="mt-1 text-xs text-emerald-700">
                    Stripe account: <code>{venue.stripeAccountId}</code>
                  </p>
                )}
              </div>
            </div>
          ) : venue.stripeAccountId ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900">Onboarding not finished</p>
                  <p className="text-sm text-amber-800">
                    Stripe needs a few more details before you can accept payments.
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Stripe account: <code>{venue.stripeAccountId}</code>
                  </p>
                </div>
              </div>
              <form action={connectAction}>
                <Button type="submit">Resume onboarding</Button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                <div>
                  <p className="font-medium text-zinc-900">Not connected yet</p>
                  <p className="text-sm text-zinc-600">
                    Connect Stripe to send payment links and let clients pay online. It takes
                    about 5 minutes — you&apos;ll need your bank details.
                  </p>
                </div>
              </div>
              <form action={connectAction}>
                <Button type="submit">Connect Stripe</Button>
              </form>
            </div>
          )}

          <div className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-600">
            <p className="font-medium text-zinc-900">How fees work</p>
            <p className="mt-1">
              Venuora adds a <strong>3% platform fee</strong> on online booking payments
              (deposits and balances). Refundable security deposits carry no platform fee, and
              payments you record manually (cash, bank transfer) are always free.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
