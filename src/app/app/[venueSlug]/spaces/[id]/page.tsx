import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, MessageSquare, Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireVenue } from "@/lib/tenancy";
import { addDays, venueDateStr, venueDow, venueLocalToUtc } from "@/lib/time";
import { DeactivateSpaceButton } from "../deactivate-button";
import { SpaceEditor } from "./space-editor";

/** Next Saturday 17:00–22:00 in the venue's timezone (used for the example price). */
function exampleSlot(timezone: string) {
  const now = new Date();
  const today = venueDateStr(now, timezone);
  const offset = (6 - venueDow(now, timezone) + 7) % 7 || 7;
  const noon = venueLocalToUtc(timezone, today, "12:00");
  const sat = venueDateStr(addDays(noon, offset), timezone);
  return {
    start: venueLocalToUtc(timezone, sat, "17:00").toISOString(),
    end: venueLocalToUtc(timezone, sat, "22:00").toISOString(),
  };
}

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ venueSlug: string; id: string }>;
}) {
  const { venueSlug, id } = await params;
  const { venue, role } = await requireVenue(venueSlug, "MANAGER");

  const space = await db.space.findUnique({
    where: { id },
    include: { ratePlan: { include: { peakPeriods: true } } },
  });
  if (!space || space.venueId !== venue.id) notFound();

  const slot = exampleSlot(venue.timezone);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/${venueSlug}/spaces`}
          className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Spaces
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-balance text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[32px]">
                {space.name}
              </h1>
              {space.active ? <Badge variant="accent">Active</Badge> : <Badge variant="muted">Inactive</Badge>}
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {space.instantBook ? (
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-primary" aria-hidden /> Instant booking
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" aria-hidden /> Request to book
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" aria-hidden /> Up to {space.seatedCapacity} seated
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/v/${venueSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> View public listing
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            {space.active && (
              <DeactivateSpaceButton
                slug={venueSlug}
                spaceId={space.id}
                spaceName={space.name}
                appearance="outline"
              />
            )}
          </div>
        </div>
        {!venue.published && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Your venue page isn&apos;t published yet, so the public listing won&apos;t be available until you publish it.
          </p>
        )}
      </div>

      <SpaceEditor
        slug={venueSlug}
        spaceId={space.id}
        spaceName={space.name}
        active={space.active}
        isOwner={role === "OWNER"}
        spaceInitial={{
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
        rateInitial={
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
        example={{
          start: slot.start,
          end: slot.end,
          timezone: venue.timezone,
          currency: venue.currency,
          taxBps: venue.taxBps,
        }}
      />
    </div>
  );
}
