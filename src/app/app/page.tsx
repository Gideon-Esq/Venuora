import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { PLAN_SPACE_LIMITS } from "@/lib/stripe";
import { myVenues, requireUser } from "@/lib/tenancy";
import { AppTopBar } from "./top-bar";

export const metadata = { title: "Your venues — Venuora" };

function properCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default async function AppHomePage() {
  const user = await requireUser();
  const memberships = await myVenues();

  if (memberships.length === 0) redirect("/app/new");
  if (memberships.length === 1) redirect(`/app/${memberships[0].venue.slug}`);

  const counts = await db.space.groupBy({
    by: ["venueId"],
    where: { venueId: { in: memberships.map((m) => m.venue.id) }, active: true },
    _count: { _all: true },
  });
  const spaceCount = new Map(counts.map((c) => [c.venueId, c._count._all]));

  return (
    <div className="min-h-screen bg-background">
      <AppTopBar userName={user.name ?? user.email} />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <PageHeader
          title="Your venues"
          description="Choose a venue to manage or create another one."
          actions={
            <Link href="/app/new" className={buttonVariants()}>
              <Plus className="h-4 w-4" aria-hidden />
              Create another venue
            </Link>
          }
        />

        <ul className="mt-8 space-y-4">
          {memberships.map(({ venue, role }) => {
            const used = spaceCount.get(venue.id) ?? 0;
            const limit = PLAN_SPACE_LIMITS[venue.planTier] ?? 1;
            const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
            const location = [venue.city, venue.region].filter(Boolean).join(", ");
            return (
              <li key={venue.id}>
                <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    {venue.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={venue.logoUrl}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-lg border border-border bg-card object-contain"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="mt-1 h-4 w-4 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: venue.brandColor }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-semibold text-foreground">{venue.name}</h2>
                      <p className="truncate text-sm text-muted-foreground">
                        {location || "No city set"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant={venue.published ? "success" : "muted"}>
                          {venue.published ? "Published" : "Draft"}
                        </Badge>
                        <Badge variant="accent">{properCase(venue.planTier)} plan</Badge>
                        <Badge variant="outline">{properCase(role)}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="w-full sm:w-44">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{used}</span> of {limit} spaces
                    </p>
                    <div
                      className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label={`${used} of ${limit} spaces used`}
                      aria-valuenow={used}
                      aria-valuemin={0}
                      aria-valuemax={limit}
                    >
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <Link
                    href={`/app/${venue.slug}`}
                    className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}
                    aria-label={`Open ${venue.name}`}
                  >
                    Open venue
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
