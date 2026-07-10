import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireVenue } from "@/lib/tenancy";
import { GeneralForm } from "./general-form";

export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "OWNER");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Venue details</CardTitle>
        <CardDescription>
          Contact details and address — used on quotes, emails and your public page.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
