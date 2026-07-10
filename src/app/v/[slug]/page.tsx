import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Ruler,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import type { CancellationTier } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { PhotoOrPlaceholder, photoList } from "@/components/public/photo";
import { PolicySummary } from "@/components/public/policy-summary";
import { PoweredByFooter } from "@/components/public/branded-header";
import { monthAvailability, normalizeMonth, type MonthGrid } from "./availability";

// Fully server-rendered (calendar month switching is searchParams-driven) —
// no client JS on this page.

async function getVenue(slug: string) {
  const venue = await db.venue.findUnique({
    where: { slug },
    include: {
      spaces: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: { ratePlan: true },
      },
    },
  });
  if (!venue || !venue.published) notFound();
  return venue;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const venue = await db.venue.findUnique({
    where: { slug },
    select: { name: true, city: true, description: true, published: true },
  });
  if (!venue || !venue.published) return { title: "Venue not found" };
  return {
    title: `${venue.name}${venue.city ? ` — ${venue.city}` : ""}`,
    description:
      venue.description?.slice(0, 160) ??
      `Check availability and book ${venue.name} online.`,
  };
}

function fromPriceCents(rp: {
  hourlyRateCents: number;
  minBookingHours: number;
  halfDayCents: number | null;
  fullDayCents: number | null;
  eveningCents: number | null;
} | null): number | null {
  if (!rp) return null;
  const candidates = [
    rp.hourlyRateCents * rp.minBookingHours,
    rp.halfDayCents,
    rp.fullDayCents,
    rp.eveningCents,
  ].filter((c): c is number => c != null && c > 0);
  return candidates.length ? Math.min(...candidates) : null;
}

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const venue = await getVenue(slug);

  const month = normalizeMonth(sp.month, venue.timezone);
  const grid = await monthAvailability(
    venue,
    venue.spaces.map((s) => s.id),
    month
  );

  const photos = photoList(venue.photos);
  const addressParts = [
    venue.addressLine1,
    venue.addressLine2,
    venue.city,
    venue.region,
    venue.postalCode,
  ].filter(Boolean) as string[];
  const directionsQuery = [venue.name, ...addressParts, venue.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="public-page flex flex-1 flex-col bg-zinc-50">
      {/* Brand bar + header */}
      <div aria-hidden className="h-1.5 w-full" style={{ backgroundColor: venue.brandColor }} />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="inline-flex items-center gap-3">
            {venue.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={venue.logoUrl}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-lg object-cover"
              />
            ) : null}
            <span className="text-base font-semibold tracking-tight text-zinc-900">
              {venue.name}
            </span>
          </span>
          <Link
            href={`/v/${venue.slug}/book`}
            className="hidden rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm sm:inline-block"
            style={{ backgroundColor: venue.brandColor }}
          >
            Check availability
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 sm:px-6">
        {/* Hero */}
        <section className="pt-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            {venue.name}
          </h1>
          {(venue.city || venue.region) && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-zinc-600">
              <MapPin className="h-4 w-4" aria-hidden />
              {[venue.city, venue.region].filter(Boolean).join(", ")}
            </p>
          )}

          {/* Gallery */}
          <div className="mt-6 grid grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl">
            <div className="col-span-4 row-span-2 aspect-[16/9] sm:col-span-2 sm:aspect-auto">
              <PhotoOrPlaceholder
                src={photos[0]}
                alt={`${venue.name} — main photo`}
                seed={0}
                loading="eager"
              />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="hidden aspect-[4/3] sm:block">
                <PhotoOrPlaceholder
                  src={photos[i]}
                  alt={`${venue.name} — photo ${i + 1}`}
                  seed={i}
                />
              </div>
            ))}
          </div>

          {venue.description && (
            <p className="mt-6 max-w-3xl whitespace-pre-line text-pretty leading-7 text-zinc-700">
              {venue.description}
            </p>
          )}

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/v/${venue.slug}/book`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-medium text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: venue.brandColor }}
            >
              <CalendarDays className="h-5 w-5" aria-hidden />
              Check availability &amp; book
            </Link>
            <Link
              href={`/v/${venue.slug}/tour`}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-base font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Book a tour
            </Link>
          </div>
        </section>

        {/* Spaces */}
        <section className="mt-14" aria-labelledby="spaces-heading">
          <h2 id="spaces-heading" className="text-2xl font-semibold tracking-tight text-zinc-900">
            Spaces
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {venue.spaces.map((space, idx) => {
              const spacePhotos = photoList(space.photos);
              const amenities = (space.amenities as string[] | null) ?? [];
              const layouts =
                (space.layouts as { name: string; capacity: number }[] | null) ?? [];
              const from = fromPriceCents(space.ratePlan);
              return (
                <article
                  key={space.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="aspect-[16/9]">
                    <PhotoOrPlaceholder
                      src={spacePhotos[0]}
                      alt={`${space.name} photo`}
                      seed={idx + 1}
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-zinc-900">{space.name}</h3>
                      {space.instantBook ? (
                        <Badge className="shrink-0 bg-emerald-100 text-emerald-800">
                          <Zap className="mr-1 h-3 w-3" aria-hidden />
                          Instant booking
                        </Badge>
                      ) : (
                        <Badge className="shrink-0 bg-sky-100 text-sky-800">Request to book</Badge>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-4 w-4" aria-hidden />
                        {space.seatedCapacity} seated · {space.standingCapacity} standing
                      </span>
                      {space.floorAreaSqm ? (
                        <span className="inline-flex items-center gap-1">
                          <Ruler className="h-4 w-4" aria-hidden />
                          {space.floorAreaSqm} m²
                        </span>
                      ) : null}
                    </div>

                    {space.description && (
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-600">
                        {space.description}
                      </p>
                    )}

                    {amenities.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {amenities.map((a) => (
                          <Badge key={a} className="bg-zinc-100 text-zinc-700">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {layouts.length > 0 && (
                      <p className="mt-3 text-sm text-zinc-600">
                        <span className="font-medium text-zinc-900">Layouts: </span>
                        {layouts.map((l) => `${l.name} (${l.capacity})`).join(" · ")}
                      </p>
                    )}

                    <div className="mt-auto flex items-end justify-between pt-4">
                      {from != null ? (
                        <p className="text-sm text-zinc-600">
                          from{" "}
                          <span className="text-lg font-semibold text-zinc-900">
                            {formatMoney(from, venue.currency)}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-500">Pricing on request</p>
                      )}
                      <Link
                        href={`/v/${venue.slug}/book?space=${space.id}`}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                        style={{ backgroundColor: venue.brandColor }}
                      >
                        Book this space
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
            {venue.spaces.length === 0 && (
              <p className="text-zinc-500">This venue hasn&apos;t listed any spaces yet.</p>
            )}
          </div>
        </section>

        {/* Availability calendar */}
        <section id="availability" className="mt-14 scroll-mt-6" aria-labelledby="avail-heading">
          <h2 id="avail-heading" className="text-2xl font-semibold tracking-tight text-zinc-900">
            Availability
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Across all spaces. Pick a date in the booking flow to see exact times.
          </p>
          <AvailabilityCalendar grid={grid} slug={venue.slug} />
        </section>

        {/* Reviews placeholder */}
        <section className="mt-14" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="text-2xl font-semibold tracking-tight text-zinc-900">
            Reviews
          </h2>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-zinc-500">
            <Star className="h-5 w-5 shrink-0" aria-hidden />
            <p className="text-sm">Reviews coming soon — this venue recently joined Venuora.</p>
          </div>
        </section>

        {/* Location */}
        {(addressParts.length > 0 || venue.city) && (
          <section className="mt-14" aria-labelledby="location-heading">
            <h2
              id="location-heading"
              className="text-2xl font-semibold tracking-tight text-zinc-900"
            >
              Location
            </h2>
            <div className="mt-4 flex flex-col justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-6 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
                <address className="text-sm not-italic leading-6 text-zinc-700">
                  {addressParts.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionsQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Get directions
              </a>
            </div>
          </section>
        )}

        {/* House rules & policies */}
        <section className="mt-14" aria-labelledby="policies-heading">
          <h2 id="policies-heading" className="text-2xl font-semibold tracking-tight text-zinc-900">
            House rules &amp; policies
          </h2>
          <div className="mt-4 space-y-6 rounded-2xl border border-zinc-200 bg-white p-6">
            {venue.houseRules && (
              <div>
                <h4 className="text-sm font-medium text-zinc-900">House rules</h4>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-zinc-700">
                  {venue.houseRules}
                </p>
              </div>
            )}
            <PolicySummary
              depositPct={venue.depositPct}
              balanceDueDays={venue.balanceDueDays}
              securityDepositCents={venue.securityDepositCents}
              currency={venue.currency}
              cancellationTiers={venue.cancellationTiers as unknown as CancellationTier[]}
            />
          </div>
        </section>
      </main>

      <PoweredByFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server-rendered month grid (searchParams-driven month switching)
// ---------------------------------------------------------------------------

const DAY_STYLES = {
  free: "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200",
  partly: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200",
  full: "bg-rose-50 text-rose-400 ring-1 ring-inset ring-rose-200 line-through",
} as const;

function AvailabilityCalendar({ grid, slug }: { grid: MonthGrid; slug: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between">
        {grid.prevMonth ? (
          <Link
            href={`/v/${slug}?month=${grid.prevMonth}#availability`}
            aria-label="Previous month"
            className="rounded-lg border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-50"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <span className="rounded-lg border border-zinc-200 p-2 text-zinc-300">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </span>
        )}
        <p className="text-base font-semibold text-zinc-900">{grid.label}</p>
        {grid.nextMonth ? (
          <Link
            href={`/v/${slug}?month=${grid.nextMonth}#availability`}
            aria-label="Next month"
            className="rounded-lg border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-50"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <span className="rounded-lg border border-zinc-200 p-2 text-zinc-300">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: grid.leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {grid.days.map((day) =>
          day.isPast ? (
            <div
              key={day.date}
              className="flex aspect-square items-center justify-center rounded-lg text-sm text-zinc-300"
            >
              {day.dayOfMonth}
            </div>
          ) : day.status === "full" ? (
            <div
              key={day.date}
              title="Fully booked"
              className={`flex aspect-square items-center justify-center rounded-lg text-sm ${DAY_STYLES.full}`}
            >
              {day.dayOfMonth}
            </div>
          ) : (
            <Link
              key={day.date}
              href={`/v/${slug}/book?date=${day.date}`}
              title={day.status === "free" ? "Free" : "Partly booked"}
              className={`flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-transform hover:scale-105 ${DAY_STYLES[day.status]}`}
            >
              {day.dayOfMonth}
            </Link>
          )
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-600">
        <LegendDot className="bg-emerald-400" label="Free" />
        <LegendDot className="bg-amber-400" label="Partly booked" />
        <LegendDot className="bg-rose-400" label="Fully booked" />
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}
