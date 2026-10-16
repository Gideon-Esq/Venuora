import { db } from "@/lib/db";
import { requireVenue } from "@/lib/tenancy";
import { venueDateStr } from "@/lib/time";
import { toTourView } from "./tour-shared";
import { ToursWorkspace } from "./tours-workspace";
export const metadata = { title: "Tours" };
export default async function ToursPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "MANAGER");
  const [tours, spaces] = await Promise.all([
    db.tourRequest.findMany({ where: { venueId: venue.id }, orderBy: { requestedAt: "asc" } }),
    db.space.findMany({ where: { venueId: venue.id }, select: { id: true, name: true, active: true } }),
  ]);
  const now = new Date();
  const context = { tz: venue.timezone, now, spaceNames: new Map(spaces.map((space) => [space.id, space.name])) };
  return <ToursWorkspace slug={venueSlug} tours={tours.map((tour) => toTourView(tour, context))} spaces={spaces.filter((space) => space.active)} today={venueDateStr(now, venue.timezone)} timezone={venue.timezone} />;
}
