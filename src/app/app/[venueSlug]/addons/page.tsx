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

  const addOns = await db.addOn.findMany({
    where: { venueId: venue.id },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
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

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Add-ons</h1>
        <p className="text-sm text-zinc-500">
          Extras clients can add to any booking — equipment, services, staff. They show up on
          quotes and invoices automatically.
        </p>
      </div>
      <AddOnsManager slug={venueSlug} addOns={rows} currency={venue.currency} />
    </div>
  );
}
