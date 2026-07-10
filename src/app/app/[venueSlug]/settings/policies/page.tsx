import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>Booking policies</CardTitle>
        <CardDescription>
          Deposits, due dates, tax and cancellations. Changes apply to new bookings only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PoliciesForm
          slug={venueSlug}
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
      </CardContent>
    </Card>
  );
}
