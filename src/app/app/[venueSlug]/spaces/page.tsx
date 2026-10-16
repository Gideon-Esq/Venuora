import Link from "next/link";
import { Gauge, LayoutGrid, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { PLAN_SPACE_LIMITS } from "@/lib/stripe";
import { requireVenue } from "@/lib/tenancy";
import { SpacesList, type SpaceRow } from "./spaces-list";

export default async function SpacesPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue, role } = await requireVenue(venueSlug, "MANAGER");

  const spaces = await db.space.findMany({
    where: { venueId: venue.id },
    include: { ratePlan: true },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
  });

  const activeCount = spaces.filter((s) => s.active).length;
  const limit = PLAN_SPACE_LIMITS[venue.planTier] ?? 1;
  const isOwner = role === "OWNER";
  const needsRates = spaces.filter((s) => s.active && !s.ratePlan);

  const rows: SpaceRow[] = spaces.map((s) => {
    const photos = (s.photos ?? []) as unknown as string[];
    return {
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      photo: photos[0] ?? null,
      color: s.color,
      active: s.active,
      instantBook: s.instantBook,
      seated: s.seatedCapacity,
      standing: s.standingCapacity,
      setupMins: s.setupBufferMins,
      teardownMins: s.teardownBufferMins,
      fromRate: s.ratePlan ? formatMoney(s.ratePlan.hourlyRateCents, venue.currency) : null,
    };
  });

  const addSpace = (
    <Link href={`/app/${venueSlug}/spaces/new`} className={buttonVariants()}>
      <Plus className="h-4 w-4" aria-hidden /> Add space
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace spaces"
        eyebrowIcon={LayoutGrid}
        title="Spaces"
        description="Set up the rooms and areas clients can book."
        actions={addSpace}
      />

      <div className="flex flex-col gap-3 rounded-xl border border-accent bg-accent/70 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card/70 text-primary">
          <Gauge className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            {activeCount} of {limit} space{limit === 1 ? "" : "s"} used
          </p>
          <p className="text-sm text-muted-foreground">
            Your current plan includes up to {limit} space{limit === 1 ? "" : "s"}.
          </p>
        </div>
        {isOwner && (
          <Link
            href={`/app/${venueSlug}/settings/billing`}
            className="inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            View plan limits
          </Link>
        )}
      </div>

      {spaces.length === 0 ? (
        <Card>
          <EmptyState
            icon={LayoutGrid}
            title="No spaces yet"
            description="Your public page needs at least one active space before clients can book. Add your first space — it takes about two minutes."
            action={<div className="flex flex-wrap justify-center gap-3">{addSpace}{isOwner && <Link href={`/app/${venueSlug}/onboarding`} className={buttonVariants({variant:"outline"})}>Open setup</Link>}</div>}
          />
        </Card>
      ) : (
        <SpacesList slug={venueSlug} spaces={rows} />
      )}

      {needsRates.length > 0 && (
        <Callout tone="warning" title="Needs attention">
          <ul className="space-y-1">
            {needsRates.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/app/${venueSlug}/spaces/${s.id}?tab=rates`}
                  className="font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {s.name}
                </Link>{" "}
                needs rates before bookings can be priced automatically.
              </li>
            ))}
          </ul>
        </Callout>
      )}
    </div>
  );
}
