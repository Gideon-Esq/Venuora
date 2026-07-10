import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { subscribeAction } from "@/actions/venue";
import { requireVenue } from "@/lib/tenancy";
import { formatInVenueTz } from "@/lib/time";

const PLANS = [
  {
    tier: "SOLO" as const,
    name: "Solo",
    price: "$49",
    blurb: "For a single hall or studio.",
    features: ["1 space", "Unlimited bookings", "Online payments", "Quotes & reminders"],
  },
  {
    tier: "GROWTH" as const,
    name: "Growth",
    price: "$99",
    blurb: "For venues with a few rooms.",
    features: ["Up to 5 spaces", "Everything in Solo", "Team members", "Peak-season pricing"],
  },
  {
    tier: "PRO" as const,
    name: "Pro",
    price: "$199",
    blurb: "For multi-hall event centers.",
    features: ["Up to 10 spaces", "Everything in Growth", "Priority support"],
  },
];

const TIER_LABELS: Record<string, string> = {
  TRIAL: "Free trial",
  SOLO: "Solo",
  GROWTH: "Growth",
  PRO: "Pro",
};

export default async function BillingSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ dev_subscribed?: string }>;
}) {
  const { venueSlug } = await params;
  const sp = await searchParams;
  const { venue } = await requireVenue(venueSlug, "OWNER");

  return (
    <div className="space-y-4">
      {sp.dev_subscribed && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          You&apos;re now on the {TIER_LABELS[sp.dev_subscribed] ?? sp.dev_subscribed} plan.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your plan</CardTitle>
          <CardDescription>Every plan starts with a 30-day free trial — no card needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-600">Current plan:</span>
            <Badge className="bg-indigo-100 text-indigo-700">
              {TIER_LABELS[venue.planTier] ?? venue.planTier}
            </Badge>
            {venue.planTier === "TRIAL" && venue.trialEndsAt && (
              <span className="text-zinc-500">
                Trial ends {formatInVenueTz(venue.trialEndsAt, venue.timezone, "EEE, MMM d yyyy")}.
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = venue.planTier === plan.tier;
              const choose = subscribeAction.bind(null, venueSlug, plan.tier);
              return (
                <div
                  key={plan.tier}
                  className={
                    isCurrent
                      ? "rounded-xl border-2 border-indigo-600 p-4"
                      : "rounded-xl border border-zinc-200 p-4"
                  }
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-semibold text-zinc-900">{plan.name}</h3>
                    <p>
                      <span className="text-xl font-bold text-zinc-900">{plan.price}</span>
                      <span className="text-xs text-zinc-500">/mo</span>
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{plan.blurb}</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-zinc-700">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> {f}
                      </li>
                    ))}
                  </ul>
                  <form action={choose} className="mt-4">
                    <Button
                      type="submit"
                      variant={isCurrent ? "secondary" : "default"}
                      disabled={isCurrent}
                      className="w-full"
                    >
                      {isCurrent ? "Current plan" : `Choose ${plan.name}`}
                    </Button>
                  </form>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
