import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requireVenue } from "@/lib/tenancy";
import { PoliciesForm } from "./policies-form";

export default async function PoliciesSettingsPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "OWNER");

  const tiers = (venue.cancellationTiers ?? []) as unknown as {
    minDaysBefore: number;
    refundPct: number;
  }[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Settings · Policies</p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">Booking policies</h2>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Set the payment and cancellation rules clients will see before they book.
          </p>
        </div>
        <Badge variant="accent" className="px-2.5 py-1 text-[13px]">
          <Lock aria-hidden />
          Owner only
        </Badge>
      </div>
      <PoliciesForm
        slug={venueSlug}
        venueName={venue.name}
        currency={venue.currency}
        initial={{
          depositPct: venue.depositPct,
          balanceDueDays: venue.balanceDueDays,
          securityDepositCents: venue.securityDepositCents,
          autoChargeBalance: venue.autoChargeBalance,
          taxBps: venue.taxBps,
          houseRules: venue.houseRules ?? "",
          cancellationTiers: tiers,
        }}
      />
    </div>
  );
}
