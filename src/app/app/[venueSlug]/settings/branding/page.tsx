import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireVenue } from "@/lib/tenancy";
import { BrandingForm } from "./branding-form";

export default async function BrandingSettingsPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "OWNER");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Make your public page and emails look like you — not like software.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BrandingForm
          slug={venueSlug}
          venueName={venue.name}
          initial={{
            brandColor: venue.brandColor,
            logoUrl: venue.logoUrl ?? "",
            photos: (venue.photos ?? []) as unknown as string[],
          }}
        />
      </CardContent>
    </Card>
  );
}
