import Link from "next/link";
import { Clock, Plus, Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requireVenue } from "@/lib/tenancy";

export default async function SpacesPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "MANAGER");

  const spaces = await db.space.findMany({
    where: { venueId: venue.id },
    include: { ratePlan: true },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Spaces</h1>
          <p className="text-sm text-zinc-500">
            The rooms and halls clients can book. Each has its own rates and buffers.
          </p>
        </div>
        <Link href={`/app/${venueSlug}/spaces/new`} className={buttonVariants()}>
          <Plus className="h-4 w-4" /> Add space
        </Link>
      </div>

      {spaces.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-zinc-500">
            No spaces yet. Add your first space — it takes about two minutes.
          </p>
          <Link
            href={`/app/${venueSlug}/spaces/new`}
            className={buttonVariants({ className: "mt-4" })}
          >
            <Plus className="h-4 w-4" /> Add your first space
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((s) => {
            const photos = (s.photos ?? []) as unknown as string[];
            return (
              <Link key={s.id} href={`/app/${venueSlug}/spaces/${s.id}`} className="group block">
                <Card className="overflow-hidden transition-shadow group-hover:shadow-md">
                  {photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photos[0]}
                      alt={s.name}
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-36 w-full items-end p-3"
                      style={{
                        background: `linear-gradient(135deg, ${s.color}22, ${s.color}66)`,
                      }}
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                    </div>
                  )}
                  <div className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold text-zinc-900">{s.name}</h2>
                      {!s.active ? (
                        <Badge className="bg-zinc-100 text-zinc-500">Inactive</Badge>
                      ) : s.instantBook ? (
                        <Badge className="bg-indigo-100 text-indigo-700">
                          <Zap className="mr-1 h-3 w-3" /> Instant book
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-zinc-400" />
                        {s.seatedCapacity} seated · {s.standingCapacity} standing
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-zinc-400" />
                        {s.setupBufferMins}m setup / {s.teardownBufferMins}m teardown
                      </span>
                    </div>
                    <div className="text-sm">
                      {s.ratePlan ? (
                        <span className="font-medium text-zinc-900">
                          from {formatMoney(s.ratePlan.hourlyRateCents, venue.currency)}/hr
                        </span>
                      ) : (
                        <span className="text-amber-700">No rates set yet — add them</span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
