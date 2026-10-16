import { db } from "@/lib/db";
import { requireVenue } from "@/lib/tenancy";
import { AddOnsManager, type AddOnRow } from "./addons-manager";

export default async function AddOnsPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "MANAGER");

  // Stable order (sortOrder only) so rows don't jump when toggled on/off.
  const addOns = await db.addOn.findMany({
    where: { venueId: venue.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const rows: AddOnRow[] = addOns.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    priceCents: a.priceCents,
    pricingType: a.pricingType,
    maxQuantity: a.maxQuantity,
    active: a.active,
  }));

  return <AddOnsManager slug={venueSlug} addOns={rows} currency={venue.currency} />;
}
