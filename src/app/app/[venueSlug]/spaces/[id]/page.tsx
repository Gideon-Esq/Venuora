import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requireVenue } from "@/lib/tenancy";
import { DeactivateSpaceButton } from "../deactivate-button";
import { RatePlanForm } from "../rate-plan-form";
import { SpaceForm } from "../space-form";

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue } = await requireVenue(venueSlug, "MANAGER");

  const space = await db.space.findUnique({
    where: { id },
    include: { ratePlan: { include: { peakPeriods: true } } },
  });
  if (!space || space.venueId !== venue.id) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div>
        <Link
          href={`/app/${venueSlug}/spaces`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> All spaces
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">{space.name}</h1>
          {!space.active && <Badge className="bg-zinc-100 text-zinc-500">Inactive</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Space details</CardTitle>
        </CardHeader>
        <CardContent>
          <SpaceForm
            slug={venueSlug}
            spaceId={space.id}
            initial={{
              name: space.name,
              description: space.description ?? "",
              seatedCapacity: space.seatedCapacity,
              standingCapacity: space.standingCapacity,
              floorAreaSqm: space.floorAreaSqm,
              amenities: (space.amenities ?? []) as unknown as string[],
              layouts: (space.layouts ?? []) as unknown as { name: string; capacity: number }[],
              photos: (space.photos ?? []) as unknown as string[],
              color: space.color,
              setupBufferMins: space.setupBufferMins,
              teardownBufferMins: space.teardownBufferMins,
              instantBook: space.instantBook,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rates</CardTitle>
          <CardDescription>
            {space.ratePlan
              ? "How this space is priced. Changes only affect new bookings — existing prices never change."
              : "Set the rates so this space can be booked and quoted."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RatePlanForm
            slug={venueSlug}
            spaceId={space.id}
            initial={
              space.ratePlan
                ? {
                    hourlyRateCents: space.ratePlan.hourlyRateCents,
                    minBookingHours: space.ratePlan.minBookingHours,
                    halfDayCents: space.ratePlan.halfDayCents,
                    halfDayHours: space.ratePlan.halfDayHours,
                    fullDayCents: space.ratePlan.fullDayCents,
                    fullDayHours: space.ratePlan.fullDayHours,
                    eveningCents: space.ratePlan.eveningCents,
                    eveningHours: space.ratePlan.eveningHours,
                    eveningStartHour: space.ratePlan.eveningStartHour,
                    overtimeHourlyCents: space.ratePlan.overtimeHourlyCents,
                    dowMultipliers: (space.ratePlan.dowMultipliers ?? []) as unknown as number[],
                    peakPeriods: space.ratePlan.peakPeriods.map((p) => ({
                      name: p.name,
                      startDate: p.startDate,
                      endDate: p.endDate,
                      multiplierPct: p.multiplierPct,
                    })),
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      {space.active && (
        <Card>
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
            <CardDescription>
              Deactivating hides this space from clients. Existing bookings are untouched.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeactivateSpaceButton slug={venueSlug} spaceId={space.id} spaceName={space.name} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
