import Link from "next/link";
import { ArrowRight, Check, ChevronDown, CircleDashed, CreditCard, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { connectStripeAction } from "@/actions/venue";
import { db } from "@/lib/db";
import { requireVenue } from "@/lib/tenancy";
import { cn } from "@/lib/utils";
import { LiveView } from "./live-view";
import { PublishPanel } from "./publish-button";

type Step = {
  key: "details" | "space" | "rates" | "addons" | "policies" | "stripe" | "publish";
  title: string;
  done: boolean;
  optional?: boolean;
  /** Shown when the step is incomplete. */
  todo: string;
  /** Shown in the compact checklist when complete. */
  doneNote: string;
  cta?: React.ReactNode;
};

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
  const base = `/app/${venueSlug}`;

  const linkCta = (href: string, label: string, primary = false) => (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: primary ? "default" : "outline" }), "w-full sm:w-auto")}
    >
      {label} <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  );

  const steps: Step[] = [
    {
      key: "details",
      title: "Venue details",
      done: venue.onboardingStep >= 1,
      todo: "Add your name, contact details and address. They appear on quotes and your public page.",
      doneNote: "Name, contact details and address saved.",
      cta: linkCta(`${base}/settings/general`, "Fix it"),
    },
    {
      key: "space",
      title: "Add your first space",
      done: spaceCount > 0,
      todo: "A space is a room or hall clients can book, like “Main Hall”. You need one to publish.",
      doneNote: `${spaceCount} active space${spaceCount === 1 ? "" : "s"} set up.`,
      cta: linkCta(`${base}/spaces/new`, "Add a space", true),
    },
    {
      key: "rates",
      title: "Set your rates",
      done: ratePlanCount > 0,
      todo: "Add hourly rates or packages on each space so quotes and online booking can price themselves.",
      doneNote: "Rates are set.",
      cta: linkCta(`${base}/spaces`, "Go to spaces"),
    },
    {
      key: "addons",
      title: "Add-ons",
      optional: true,
      done: addOnCount > 0,
      todo: "Optional extras like chairs, a projector or cleaning. Skip it and add them any time.",
      doneNote: `${addOnCount} add-on${addOnCount === 1 ? "" : "s"} available.`,
      cta: linkCta(`${base}/addons`, "Set up add-ons"),
    },
    {
      key: "policies",
      title: "Booking policies",
      done: venue.onboardingStep >= 5,
      todo: "Review your deposit, balance due date and cancellation rules. Sensible defaults are already in place.",
      doneNote: "Deposit and cancellation rules reviewed.",
      cta: linkCta(`${base}/settings/policies`, "Review policies"),
    },
    {
      key: "stripe",
      title: "Connect Stripe",
      done: venue.stripeChargesEnabled,
      todo: "Let clients pay deposits and balances online, straight to your bank account. Takes about 5 minutes.",
      doneNote: "Connected. Clients can pay online.",
      cta: (
        <form action={connectAction}>
          <Button type="submit" variant="outline" className="w-full sm:w-auto">
            <CreditCard className="h-4 w-4" aria-hidden />
            {venue.stripeAccountId ? "Resume Stripe setup" : "Connect Stripe"}
          </Button>
        </form>
      ),
    },
    {
      key: "publish",
      title: "Publish your venue page",
      done: venue.published,
      todo: "Make your public page live so clients can browse, inquire and book.",
      doneNote: "Your public page is live.",
    },
  ];

  if (venue.published) {
    const hrefs: Partial<Record<Step["key"], string>> = {
      details: `${base}/settings/general`,
      space: `${base}/spaces/new`,
      rates: `${base}/spaces`,
      addons: `${base}/addons`,
      policies: `${base}/settings/policies`,
      stripe: `${base}/settings/payments`,
    };
    return (
      <LiveView
        slug={venueSlug}
        venueName={venue.name}
        publicUrl={publicUrl}
        steps={steps.map((s) => ({
          key: s.key,
          title: s.title,
          done: s.done,
          optional: s.optional,
          href: hrefs[s.key],
        }))}
      />
    );
  }

  const doneCount = steps.filter((step) => step.done).length;
  const pct = Math.round(doneCount / steps.length * 100);
  const ready = spaceCount > 0;
  const next = steps.find(step => !step.done && step.key !== "publish");
  return <div className="mx-auto max-w-5xl space-y-6">
    <p className="text-xs text-muted-foreground"><Link href={`${base}/settings`} className="hover:underline">Settings</Link> / Setup</p>
    <PageHeader title={`Get ${venue.name} ready to publish`} description="Complete these steps in any order. You can leave and come back without losing progress." actions={<a href={`#setup-${next?.key ?? "publish"}`} className={buttonVariants()}>Resume setup</a>} />
    <Card><CardContent className="p-5 sm:p-6"><p className="text-xs text-muted-foreground">Setup progress</p><p className="mt-1 text-xl font-semibold">{doneCount} of {steps.length} complete</p><div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${pct}%`}} /></div><p className="mt-3 text-xs text-primary">{ready ? "Ready to publish. You can finish the remaining setup later." : "Add an active space to make your public page ready."}</p></CardContent></Card>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section><h2 className="text-lg font-semibold">Setup checklist</h2><p className="mb-4 mt-1 text-sm text-muted-foreground">Finish the essentials, then add anything that helps your venue stand out.</p><div className="space-y-3">{steps.map(step => <details id={`setup-${step.key}`} key={step.key} className="group scroll-mt-24 rounded-xl border border-border bg-card"><summary className="flex cursor-pointer list-none items-center gap-3 p-4"><span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full",step.done ? "bg-success-soft text-success" : "bg-accent text-primary")}>{step.done ? <Check className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{step.title}</span><span className="mt-1 block text-xs text-muted-foreground">{step.done ? step.doneNote : step.todo}</span></span><span className={cn("hidden text-xs sm:block",step.done ? "text-success" : "text-muted-foreground")}>{step.done ? "Complete" : step.key === "publish" && ready ? "Ready" : step.optional ? "Optional" : "To do"}</span><ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary><div className="border-t border-border p-4">{step.key === "publish" ? <a href="#publish-panel" className={buttonVariants({variant:"outline"})}>Review publishing</a> : step.cta}</div></details>)}</div></section>
      <aside className="space-y-4"><Card className="p-5"><h2 className="flex items-center justify-between text-base font-semibold">Publish readiness<ShieldCheck className="h-4 w-4 text-success" /></h2><p className="mt-2 text-sm text-muted-foreground">{ready ? "Your venue meets the requirements to publish." : "Create an active space before publishing."}</p><ul className="mt-4 space-y-3 text-sm"><li className="flex items-center gap-2">{ready ? <Check className="h-4 w-4 text-success" /> : <CircleDashed className="h-4 w-4" />}At least one active space</li><li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Public URL reserved</li></ul><p className="mt-4 rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">Rates, Stripe and add-ons can be completed later. Online payments require Stripe; online pricing requires rates.</p></Card><div id="publish-panel" className="scroll-mt-24"><PublishPanel slug={venueSlug} published={venue.published} publicUrl={publicUrl} /></div><p className="text-center text-xs text-muted-foreground">You can leave and return anytime.</p></aside>
    </div>
  </div>;
}
