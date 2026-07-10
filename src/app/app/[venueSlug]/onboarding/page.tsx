import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { connectStripeAction } from "@/actions/venue";
import { db } from "@/lib/db";
import { requireVenue } from "@/lib/tenancy";
import { cn } from "@/lib/utils";
import { GeneralForm } from "../settings/general-form";
import { PublishButton } from "./publish-button";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "OWNER");

  const [spaceCount, ratePlanCount, addOnCount] = await Promise.all([
    db.space.count({ where: { venueId: venue.id, active: true } }),
    db.ratePlan.count({ where: { space: { venueId: venue.id, active: true } } }),
    db.addOn.count({ where: { venueId: venue.id, active: true } }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const publicUrl = `${appUrl}/v/${venueSlug}`;
  const connectAction = connectStripeAction.bind(null, venueSlug);

  const steps: {
    title: string;
    done: boolean;
    optional?: boolean;
    body: React.ReactNode;
  }[] = [
    {
      title: "Your venue details",
      done: venue.onboardingStep >= 1,
      body: (
        <div className="max-w-xl">
          <p className="mb-3 text-sm text-zinc-500">
            Name, contact details and address — they appear on quotes and your public page.
          </p>
          <GeneralForm
            slug={venueSlug}
            initial={{
              name: venue.name,
              timezone: venue.timezone,
              email: venue.email ?? "",
              phone: venue.phone ?? "",
              addressLine1: venue.addressLine1 ?? "",
              city: venue.city ?? "",
              region: venue.region ?? "",
              postalCode: venue.postalCode ?? "",
              country: venue.country,
              description: venue.description ?? "",
            }}
          />
        </div>
      ),
    },
    {
      title: "Add your first space",
      done: spaceCount > 0,
      body: (
        <div>
          <p className="mb-3 text-sm text-zinc-500">
            {spaceCount > 0
              ? `You have ${spaceCount} space${spaceCount === 1 ? "" : "s"} set up.`
              : "A space is a room or hall clients can book — like “Main Hall”."}
          </p>
          <Link href={`/app/${venueSlug}/spaces/new`} className={buttonVariants({ variant: spaceCount > 0 ? "outline" : "default" })}>
            {spaceCount > 0 ? "Add another space" : "Add a space"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ),
    },
    {
      title: "Set your rates",
      done: ratePlanCount > 0,
      body: (
        <div>
          <p className="mb-3 text-sm text-zinc-500">
            {ratePlanCount > 0
              ? "Rates are set — quotes and online booking can price themselves."
              : "Hourly rate, packages and weekend pricing — set them on each space's page."}
          </p>
          <Link href={`/app/${venueSlug}/spaces`} className={buttonVariants({ variant: ratePlanCount > 0 ? "outline" : "default" })}>
            Go to spaces <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ),
    },
    {
      title: "Add-ons",
      done: addOnCount > 0,
      optional: true,
      body: (
        <div>
          <p className="mb-3 text-sm text-zinc-500">
            Optional extras like chairs, projector or cleaning. You can skip this and add them
            any time.
          </p>
          <Link href={`/app/${venueSlug}/addons`} className={buttonVariants({ variant: "outline" })}>
            Set up add-ons <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ),
    },
    {
      title: "Booking policies",
      done: venue.onboardingStep >= 5,
      body: (
        <div>
          <p className="mb-3 text-sm text-zinc-500">
            Deposit %, when the balance is due, and your cancellation rules. Sensible defaults
            are already in place — review and save.
          </p>
          <Link href={`/app/${venueSlug}/settings/policies`} className={buttonVariants({ variant: venue.onboardingStep >= 5 ? "outline" : "default" })}>
            Review policies <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ),
    },
    {
      title: "Connect Stripe for online payments",
      done: venue.stripeChargesEnabled,
      body: (
        <div>
          <p className="mb-3 text-sm text-zinc-500">
            {venue.stripeChargesEnabled
              ? "Connected — clients can pay deposits and balances online."
              : "So clients can pay deposits online and money lands in your bank account. Takes about 5 minutes."}
          </p>
          {!venue.stripeChargesEnabled && (
            <form action={connectAction}>
              <Button type="submit">
                {venue.stripeAccountId ? "Resume Stripe onboarding" : "Connect Stripe"}
              </Button>
            </form>
          )}
        </div>
      ),
    },
    {
      title: "Publish your venue page",
      done: venue.published,
      body: (
        <div>
          {!venue.published && (
            <p className="mb-3 text-sm text-zinc-500">
              This makes your public page live at <code className="text-xs">{publicUrl}</code> so
              clients can browse and book.
            </p>
          )}
          <PublishButton slug={venueSlug} published={venue.published} publicUrl={publicUrl} />
        </div>
      ),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Set up your venue</h1>
        <p className="text-sm text-zinc-500">
          Seven quick steps and you&apos;re taking bookings. You can leave and come back any
          time — your progress is saved.
        </p>
      </div>

      {/* Progress */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-zinc-500">
          <span>
            {doneCount} of {steps.length} steps done
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Vertical steps */}
      <ol className="space-y-4">
        {steps.map((step, i) => (
          <li key={step.title}>
            <Card className={cn(step.done && "border-emerald-200")}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      step.done
                        ? "bg-emerald-600 text-white"
                        : "bg-indigo-50 text-indigo-700"
                    )}
                  >
                    {step.done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900">
                      {step.title}
                      {step.optional && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-500">
                          Optional
                        </span>
                      )}
                    </h2>
                    <div className="mt-2">{step.body}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
