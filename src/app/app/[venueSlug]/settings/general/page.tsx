import { requireVenue } from "@/lib/tenancy";
import { GeneralForm } from "../general-form";

export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "OWNER");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Settings · Venue details</p>
        <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">General</h2>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Manage your venue details and contact information.
        </p>
      </div>
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
  );
}
