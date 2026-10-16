import { requireVenue } from "@/lib/tenancy";
import { BrandingForm } from "./branding-form";

export default async function BrandingSettingsPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "OWNER");

  const photos = Array.isArray(venue.photos)
    ? (venue.photos as unknown[]).filter((p): p is string => typeof p === "string")
    : [];

  return (
    <BrandingForm
      slug={venueSlug}
      venueName={venue.name}
      initial={{
        brandColor: venue.brandColor,
        logoUrl: venue.logoUrl ?? "",
        photos,
      }}
    />
  );
}
