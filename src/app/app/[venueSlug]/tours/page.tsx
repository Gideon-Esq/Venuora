import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requireVenue } from "@/lib/tenancy";
import { formatInVenueTz } from "@/lib/time";
import { TourButtons } from "./tour-buttons";

const TOUR_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  DECLINED: "bg-rose-100 text-rose-700",
  COMPLETED: "bg-zinc-200 text-zinc-700",
  CANCELLED: "bg-zinc-100 text-zinc-500",
};

const TOUR_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default async function ToursPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "MANAGER");

  const [tours, spaces] = await Promise.all([
    db.tourRequest.findMany({
      where: { venueId: venue.id },
      orderBy: { requestedAt: "asc" },
    }),
    db.space.findMany({ where: { venueId: venue.id }, select: { id: true, name: true } }),
  ]);
  const spaceName = new Map(spaces.map((s) => [s.id, s.name]));

  const now = new Date();
  const pending = tours.filter((t) => t.status === "PENDING");
  const upcoming = tours.filter((t) => t.status === "CONFIRMED" && t.requestedAt >= now);
  const past = tours
    .filter((t) => !pending.includes(t) && !upcoming.includes(t))
    .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());

  const TourRow = ({ tour }: { tour: (typeof tours)[number] }) => (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-zinc-900">{tour.name}</span>
          <Badge className={TOUR_STATUS_STYLES[tour.status]}>
            {TOUR_STATUS_LABELS[tour.status]}
          </Badge>
        </div>
        <div className="text-sm text-zinc-600">
          {formatInVenueTz(tour.requestedAt, venue.timezone)} · 30-minute viewing
          {tour.spaceId && spaceName.get(tour.spaceId) && (
            <> · {spaceName.get(tour.spaceId)}</>
          )}
        </div>
        <div className="text-xs text-zinc-500">
          {[tour.email, tour.phone].filter(Boolean).join(" · ")}
        </div>
        {tour.notes && <p className="mt-1 text-xs text-zinc-500">&ldquo;{tour.notes}&rdquo;</p>}
      </div>
      <TourButtons slug={venueSlug} tourId={tour.id} status={tour.status} />
    </li>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Tour requests</h1>
        <p className="text-sm text-zinc-500">
          People who want to come see the venue before booking. Confirming sends them an
          email automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending {pending.length > 0 && <span className="text-amber-600">({pending.length})</span>}</CardTitle>
          <CardDescription>Waiting on your confirmation.</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing pending — nice and tidy.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {pending.map((t) => (
                <TourRow key={t.id} tour={t} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
          <CardDescription>Confirmed visits on the calendar.</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-zinc-500">No upcoming tours.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {upcoming.map((t) => (
                <TourRow key={t.id} tour={t} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past</CardTitle>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <p className="text-sm text-zinc-500">No past tours yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {past.map((t) => (
                <TourRow key={t.id} tour={t} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
