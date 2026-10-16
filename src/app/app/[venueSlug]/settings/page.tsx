import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Lock,
  Palette,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireVenue } from "@/lib/tenancy";
import { cn } from "@/lib/utils";

const TIER_LABELS: Record<string, string> = {
  TRIAL: "Free trial",
  SOLO: "Solo plan",
  GROWTH: "Growth plan",
  PRO: "Pro plan",
};

type Tone = "ok" | "todo" | "neutral";

interface Section {
  seg: string;
  title: string;
  description: string;
  icon: LucideIcon;
  status: string;
  tone: Tone;
}

export default async function SettingsOverviewPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "OWNER");
  const memberCount = await db.venueMember.count({ where: { venueId: venue.id } });

  const photos = Array.isArray(venue.photos) ? venue.photos.filter((p) => typeof p === "string") : [];
  const detailsComplete = Boolean(venue.email && venue.addressLine1);
  const brandingComplete = Boolean(venue.logoUrl) || photos.length > 0;

  let payStatus: string;
  let payTone: Tone;
  if (venue.stripeChargesEnabled) {
    payStatus = "Connected";
    payTone = "ok";
  } else if (venue.stripeAccountId) {
    payStatus = "Onboarding unfinished";
    payTone = "todo";
  } else {
    payStatus = "Not connected";
    payTone = "todo";
  }

  const now = new Date();
  let billingStatus = TIER_LABELS[venue.planTier] ?? `${venue.planTier} plan`;
  if (venue.planTier === "TRIAL" && venue.trialEndsAt) {
    const days = Math.max(0, Math.ceil((venue.trialEndsAt.getTime() - now.getTime()) / 86_400_000));
    billingStatus += days > 0 ? ` · ${days} day${days === 1 ? "" : "s"} remaining` : " · ended";
  }

  const sections: Section[] = [
    {
      seg: "general",
      title: "Venue details",
      description: "Name, contact information and address",
      icon: Building2,
      status: detailsComplete ? "Complete" : "Needs details",
      tone: detailsComplete ? "ok" : "todo",
    },
    {
      seg: "policies",
      title: "Policies",
      description: "Deposits, due dates and cancellations",
      icon: FileText,
      status: venue.onboardingStep >= 5 ? "Reviewed" : "Needs review",
      tone: venue.onboardingStep >= 5 ? "ok" : "todo",
    },
    {
      seg: "branding",
      title: "Branding",
      description: "Public page and email appearance",
      icon: Palette,
      status: brandingComplete ? "Complete" : "Add photos",
      tone: brandingComplete ? "ok" : "todo",
    },
    {
      seg: "payments",
      title: "Payments",
      description: "Stripe connection for deposits and balances",
      icon: CreditCard,
      status: payStatus,
      tone: payTone,
    },
    {
      seg: "billing",
      title: "Billing",
      description: "Your Venuora plan",
      icon: Sparkles,
      status: billingStatus,
      tone: "neutral",
    },
    {
      seg: "team",
      title: "Team",
      description: "People who can manage this venue",
      icon: Users,
      status: `${memberCount} member${memberCount === 1 ? "" : "s"}`,
      tone: "neutral",
    },
  ];

  return (
    <div className="space-y-6">
      <ul className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon;
          const StatusIcon = s.tone === "ok" ? CheckCircle2 : s.tone === "todo" ? AlertCircle : null;
          return (
            <li key={s.seg}>
              <Link
                href={`/app/${venueSlug}/settings/${s.seg}`}
                className="group relative flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(27,26,34,0.04)] transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-6"
              >
                <span className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <ArrowUpRight
                    className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary"
                    aria-hidden
                  />
                </span>
                <span className="mt-4 text-[17px] font-semibold text-foreground">{s.title}</span>
                <span className="mt-1 text-sm text-muted-foreground">{s.description}</span>
                <span
                  className={cn(
                    "mt-4 inline-flex items-center gap-1.5 text-sm font-medium",
                    s.tone === "ok" && "text-primary",
                    s.tone === "todo" && "text-warning",
                    s.tone === "neutral" && "text-foreground"
                  )}
                >
                  {StatusIcon && <StatusIcon className="h-4 w-4" aria-hidden />}
                  {s.status}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-3 rounded-xl border border-border bg-muted px-4 py-3.5 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" aria-hidden />
        Only owners can access these settings.
      </p>
    </div>
  );
}
