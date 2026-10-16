import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { venueDateStr } from "@/lib/time";
import { textOnColor } from "@/lib/color";
import { cn } from "@/lib/utils";
import type { CancellationTier } from "@/lib/pricing";
import { buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { PhotoOrPlaceholder, photoList } from "@/components/public/photo";
import { cancellationSentences } from "@/components/public/policy-summary";
import { PoweredByFooter } from "@/components/public/branded-header";
import { monthAvailability, normalizeMonth, type MonthGrid } from "./availability";
import { VenueGallery } from "./gallery";

// Server-rendered (calendar month switching is searchParams-driven); the only
// client JS is the photo lightbox.

async function getVenue(slug: string) {
  const venue = await db.venue.findUnique({
    where: { slug, published: true },
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
    where: { slug, published: true },
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

/** A link styled as a solid button in the venue's brand colour. */
function BrandLink({
  href,
  brandColor,
  className,
  children,
}: {
  href: string;
  brandColor: string;
  className?: string;
  children: ReactNode;
}) {
  const style: CSSProperties = { backgroundColor: brandColor, color: textOnColor(brandColor) };
  return (
    <Link
      href={href}
      style={style}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium shadow-sm transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className
      )}
    >
      {children}
    </Link>
  );
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
  const today = venueDateStr(new Date(), venue.timezone);

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
  const cityLine = [venue.city, venue.region].filter(Boolean).join(", ");
  const locationEyebrow = [venue.city, venue.region].filter(Boolean).join(" · ");
  const tourHref = `/v/${venue.slug}/tour`;
  const hasLocation = addressParts.length > 0 || Boolean(venue.city);
  const directionsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionsQuery)}`;
  const brand = venue.brandColor;
  const bookHref = `/v/${venue.slug}/book`;
  const cancellation = cancellationSentences(
    venue.cancellationTiers as unknown as CancellationTier[]
  );

  return (
    <div className="public-page flex flex-1 flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {venue.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={venue.logoUrl}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
                style={{ backgroundColor: brand, color: textOnColor(brand) }}
              >
                {venue.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                {venue.name}
              </p>
              {cityLine && (
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {cityLine}
                </p>
              )}
            </div>
          </div>
          <BrandLink href={bookHref} brandColor={brand} className="hidden h-10 shrink-0 sm:inline-flex">
            Check availability
          </BrandLink>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <nav aria-label="Explore the venue" className="flex gap-5 overflow-x-auto pb-1 text-xs font-medium text-muted-foreground sm:hidden"><a href="#spaces-heading" className="min-h-9 whitespace-nowrap">Spaces</a><a href="#availability" className="min-h-9 whitespace-nowrap">Availability</a><a href="#policies-heading" className="min-h-9 whitespace-nowrap">Policies</a><Link href={tourHref} className="min-h-9 whitespace-nowrap">Tour</Link></nav>
        {/* Hero — full-bleed photo with the intro below it on mobile; rounded
            photo with an overlay headline from sm up. */}
        <div>
          <section
            aria-label={`${venue.name} main photo`}
            className="relative -mx-4 -mt-6 overflow-hidden sm:mx-0 sm:mt-0 sm:rounded-xl sm:border sm:border-border"
          >
            <div className="aspect-[4/3] sm:aspect-[12/5]">
              <PhotoOrPlaceholder
                src={photos[0]}
                alt={`${venue.name} — main photo`}
                seed={0}
                loading="eager"
              />
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-black/75 via-black/25 to-transparent sm:block"
            />
            <div className="absolute inset-x-0 bottom-0 hidden p-7 sm:block">
              {locationEyebrow && (
                <p className="text-sm font-medium text-white/85">{locationEyebrow}</p>
              )}
              <h1 className="mt-1 text-balance max-w-lg text-3xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-4xl">
                Your next gathering starts here
              </h1>
              <div className="mt-4 flex flex-wrap gap-2">
                <BrandLink href={bookHref} brandColor={brand} className="h-10">
                  Check availability
                </BrandLink>
                <Link
                  href={tourHref}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-white/60 bg-white/10 px-4 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Request a tour
                </Link>
              </div>
            </div>
          </section>

          {/* Mobile intro */}
          <div className="pt-5 sm:hidden">
            {locationEyebrow && (
              <p className="text-sm font-medium text-primary">{locationEyebrow}</p>
            )}
            <h1 className="mt-1 text-balance text-3xl font-semibold tracking-tight text-foreground">
              {venue.name}
            </h1>
            <div className="mt-5 flex flex-col gap-3">
              <BrandLink href={bookHref} brandColor={brand} className="h-12 w-full text-[15px]">
                Check availability
              </BrandLink>
              <Link
                href={tourHref}
                className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full text-[15px]")}
              >
                Request a tour
              </Link>
            </div>
          </div>
        </div>

        {/* About */}
        <section aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-2xl font-semibold tracking-tight text-foreground">
            About {venue.name}
          </h2>
          {venue.description && (
            <p className="mt-3 max-w-[60ch] whitespace-pre-line text-pretty text-[15px] leading-7 text-muted-foreground">
              {venue.description}
            </p>
          )}
          <div className="mt-4 space-y-2 text-sm">
            {addressParts.length > 0 && (
              <div className="hidden items-start gap-2 text-muted-foreground sm:flex">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="sr-only">Address: </span>
                <address className="not-italic">{addressParts.join(" · ")}</address>
              </div>
            )}
            {venue.phone && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="sr-only">Phone: </span>
                <a href={`tel:${venue.phone.replace(/\s+/g, "")}`} className="hover:text-foreground hover:underline">
                  {venue.phone}
                </a>
              </p>
            )}
            {venue.email && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="sr-only">Email: </span>
                <a href={`mailto:${venue.email}`} className="break-all hover:text-foreground hover:underline">
                  {venue.email}
                </a>
              </p>
            )}
          </div>
          {hasLocation && (
            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 hidden min-h-10 items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring sm:inline-flex"
            >
              Get directions
              <ArrowUpRight className="h-4 w-4" aria-hidden />
              <span className="sr-only">(opens Google Maps in a new tab)</span>
            </a>
          )}
        </section>

        {/* Gallery (hidden when there are no photos) */}
        <VenueGallery photos={photos} venueName={venue.name} />

        {/* Spaces */}
        <section aria-labelledby="spaces-heading">
          <h2 id="spaces-heading" className="text-2xl font-semibold tracking-tight text-foreground">
            Choose your space
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choose instant booking for a date secured after deposit, or request to book so the
            venue can confirm availability first.
          </p>

          <div className="mt-5 space-y-5">
            {venue.spaces.map((space, idx) => {
              const spacePhotos = photoList(space.photos);
              const amenities = (space.amenities as string[] | null) ?? [];
              const layouts =
                (space.layouts as { name: string; capacity: number }[] | null) ?? [];
              const from = fromPriceCents(space.ratePlan);
              const href = `/v/${venue.slug}/book?space=${space.id}`;
              const capacity = [
                `Up to ${space.seatedCapacity} seated`,
                `${space.standingCapacity} standing`,
                space.floorAreaSqm ? `${space.floorAreaSqm} m²` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <article
                  key={space.id}
                  aria-labelledby={`space-${space.id}`}
                  className="rounded-xl border border-border bg-card p-3 sm:p-4"
                >
                  <div className="aspect-[16/9] overflow-hidden rounded-lg sm:aspect-[5/2]">
                    <PhotoOrPlaceholder
                      src={spacePhotos[0]}
                      alt={`${space.name} photo`}
                      seed={idx + 1}
                    />
                  </div>
                  <div className="px-1 pb-1 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3
                          id={`space-${space.id}`}
                          className="text-lg font-semibold tracking-tight text-foreground"
                        >
                          {space.name}
                        </h3>
                        <p
                          className={cn(
                            "mt-0.5 text-xs font-medium",
                            space.instantBook ? "text-primary" : "text-muted-foreground"
                          )}
                        >
                          {space.instantBook ? "Instant booking" : "Request to book"}
                        </p>
                      </div>
                      {from != null ? (
                        <p className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-right text-xs font-semibold text-accent-foreground sm:bg-transparent sm:p-0 sm:text-sm sm:text-foreground">
                          From {formatMoney(from, venue.currency)}
                        </p>
                      ) : (
                        <p className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-right text-xs text-muted-foreground sm:bg-transparent sm:p-0 sm:text-sm">
                          Pricing on request
                        </p>
                      )}
                    </div>

                    {space.description && (
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {space.description}
                      </p>
                    )}
                    {/* Mobile: capacity tiles, then area · amenities */}
                    <dl className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
                      <div className="rounded-lg bg-muted px-3 py-2">
                        <dt className="text-xs text-muted-foreground">Seated</dt>
                        <dd className="text-sm font-medium text-foreground">
                          {space.seatedCapacity} guests
                        </dd>
                      </div>
                      <div className="rounded-lg bg-muted px-3 py-2">
                        <dt className="text-xs text-muted-foreground">Standing</dt>
                        <dd className="text-sm font-medium text-foreground">
                          {space.standingCapacity} guests
                        </dd>
                      </div>
                    </dl>
                    {(space.floorAreaSqm || amenities.length > 0) && (
                      <p className="mt-2 text-xs text-muted-foreground sm:hidden">
                        {[space.floorAreaSqm ? `${space.floorAreaSqm} m²` : null, ...amenities]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {/* sm+: single capacity line, amenities below */}
                    <p className="mt-3 hidden text-sm text-foreground sm:block">{capacity}</p>
                    {amenities.length > 0 && (
                      <p className="mt-2 hidden text-sm text-muted-foreground sm:block">
                        <span className="sr-only">Amenities: </span>
                        {amenities.join(" · ")}
                      </p>
                    )}
                    {layouts.length > 0 && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Layouts: </span>
                        {layouts.map((l) => `${l.name} (${l.capacity})`).join(" · ")}
                      </p>
                    )}

                    {space.instantBook ? (
                      <BrandLink href={href} brandColor={brand} className="mt-4 h-11 w-full sm:h-10">
                        <span className="truncate">Book {space.name}</span>
                      </BrandLink>
                    ) : (
                      <Link
                        href={href}
                        className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-11 w-full sm:h-10")}
                      >
                        Request this space
                        <span className="sr-only">: {space.name}</span>
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
            {venue.spaces.length === 0 && (
              <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                This venue hasn&apos;t listed any spaces yet.
              </p>
            )}
          </div>

          {venue.spaces.length > 0 && (
            <Callout tone="neutral" className="mt-5 text-muted-foreground">
              Instant booking means your date is secured after deposit. Request to book means
              the venue confirms availability first.
            </Callout>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            Want to see it in person first?{" "}
            <Link
              href={tourHref}
              className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              Request a tour
            </Link>
          </p>
        </section>

        {/* Availability calendar */}
        <section
          id="availability"
          aria-labelledby="avail-heading"
          className="scroll-mt-6 rounded-xl border border-border bg-card p-4 sm:p-6"
        >
          <AvailabilityCalendar grid={grid} slug={venue.slug} today={today} />
          <BrandLink href={bookHref} brandColor={brand} className="mt-5 h-11 w-full">
            Start booking
          </BrandLink>
        </section>

        {/* Location & directions — mobile (sm+ shows this inside About) */}
        {hasLocation && (
          <section aria-labelledby="location-heading" className="sm:hidden">
            <h2 id="location-heading" className="text-2xl font-semibold tracking-tight text-foreground">
              Location &amp; directions
            </h2>
            <div className="mt-3 rounded-xl border border-border bg-card p-4">
              {addressParts.length > 0 && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="sr-only">Address: </span>
                  <address className="not-italic">{addressParts.join(" · ")}</address>
                </div>
              )}
              <a
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "mt-3 h-11 w-full")}
              >
                Get directions
                <ArrowUpRight className="h-4 w-4" aria-hidden />
                <span className="sr-only">(opens Google Maps in a new tab)</span>
              </a>
            </div>
          </section>
        )}

        {/* Policies */}
        <section
          aria-labelledby="policies-heading"
          className="rounded-xl border border-border bg-card p-4 sm:p-6"
        >
          <h2 id="policies-heading" className="text-xl font-semibold tracking-tight text-foreground">
            Policies
          </h2>
          <dl className="mt-4 space-y-4 text-sm leading-6">
            <PolicyRow label="Payments">
              <ul className="space-y-1">
                <li>
                  A {venue.depositPct}% deposit confirms your booking; the balance is due{" "}
                  {venue.balanceDueDays === 0
                    ? "on the day of the event"
                    : `${venue.balanceDueDays} days before the event`}
                  .
                </li>
                {venue.securityDepositCents > 0 && (
                  <li>
                    A refundable security deposit of{" "}
                    {formatMoney(venue.securityDepositCents, venue.currency)} is collected with
                    the balance and returned after the event, less any agreed deductions.
                  </li>
                )}
              </ul>
            </PolicyRow>
            {cancellation.length > 0 && (
              <PolicyRow label="Cancellation">
                <ul className="space-y-1">
                  {cancellation.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </PolicyRow>
            )}
            {venue.houseRules && (
              <PolicyRow label="House rules">
                <p className="whitespace-pre-line">{venue.houseRules}</p>
              </PolicyRow>
            )}
            {venue.email && (
              <PolicyRow label="Questions?">
                <a
                  href={`mailto:${venue.email}`}
                  className="break-all font-medium text-primary hover:underline"
                >
                  {venue.email}
                </a>
              </PolicyRow>
            )}
          </dl>
        </section>
      </main>

      <div className="border-t border-border pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
        <PoweredByFooter />
      </div>

      {/* Mobile sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3">
          <BrandLink href={bookHref} brandColor={brand} className="h-11 px-2">
            Check availability
          </BrandLink>
          <Link
            href={tourHref}
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-2")}
          >
            Request a tour
          </Link>
        </div>
      </div>
    </div>
  );
}

function PolicyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-foreground">{label}</dt>
      <dd className="mt-0.5 text-muted-foreground">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server-rendered month grid (searchParams-driven month switching)
// ---------------------------------------------------------------------------

const STATUS_LABEL = { free: "Free", partly: "Partly booked", full: "Fully booked" } as const;

/** Small half-filled circle — the "partly booked" glyph. */
function HalfDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-3 w-3 rounded-full border border-primary bg-[linear-gradient(90deg,var(--color-primary)_50%,transparent_50%)]",
        className
      )}
    />
  );
}

function MonthNav({ href, dir }: { href: string | null; dir: "prev" | "next" }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  const label = dir === "prev" ? "Previous month" : "Next month";
  const base = "inline-flex h-10 w-10 items-center justify-center rounded-lg border";
  return href ? (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        base,
        "border-border bg-card text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Link>
  ) : (
    <span aria-hidden className={cn(base, "border-border/60 text-muted-foreground/40")}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

function AvailabilityCalendar({
  grid,
  slug,
  today,
}: {
  grid: MonthGrid;
  slug: string;
  today: string;
}) {
  const [y, m] = grid.month.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="avail-heading" className="text-xl font-semibold tracking-tight text-foreground">
            Availability
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a free date to start booking. Shown across all spaces.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthNav
            dir="prev"
            href={grid.prevMonth ? `/v/${slug}?month=${grid.prevMonth}#availability` : null}
          />
          <p className="min-w-28 text-center text-sm font-semibold text-foreground" aria-live="polite">
            {grid.label}
          </p>
          <MonthNav
            dir="next"
            href={grid.nextMonth ? `/v/${slug}?month=${grid.nextMonth}#availability` : null}
          />
        </div>
      </div>

      <div
        aria-hidden
        className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground sm:gap-2"
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            <span className="sm:hidden">{d.slice(0, 2)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>
      <ul className="grid grid-cols-7 gap-1 sm:gap-2" aria-label={`Availability for ${grid.label}`}>
        {Array.from({ length: grid.leadingBlanks }).map((_, i) => (
          <li key={`blank-${i}`} aria-hidden />
        ))}
        {grid.days.map((day) => {
          const isToday = day.date === today;
          const label = `${monthName} ${day.dayOfMonth}${isToday ? ", today" : ""}: ${
            day.isPast ? "past date" : STATUS_LABEL[day.status]
          }`;
          const tile = cn(
            "relative flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-sm sm:h-14",
            isToday && "font-bold ring-2 ring-primary ring-offset-1 ring-offset-card"
          );
          const glyph =
            day.status === "full" ? (
              <Lock className="h-3 w-3" aria-hidden />
            ) : day.status === "partly" ? (
              <HalfDot className="h-2.5 w-2.5" />
            ) : null;

          if (day.isPast) {
            return (
              <li key={day.date}>
                <div
                  aria-label={label}
                  className={cn(tile, "border-border/50 bg-transparent text-muted-foreground/45")}
                >
                  {day.dayOfMonth}
                </div>
              </li>
            );
          }
          if (day.status === "full") {
            return (
              <li key={day.date}>
                <div
                  aria-label={label}
                  title="Fully booked"
                  className={cn(tile, "border-border bg-muted text-muted-foreground")}
                >
                  {day.dayOfMonth}
                  {glyph}
                </div>
              </li>
            );
          }
          return (
            <li key={day.date}>
              <Link
                href={`/v/${slug}/book?date=${day.date}`}
                aria-label={label}
                title={STATUS_LABEL[day.status]}
                className={cn(
                  tile,
                  "font-medium text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  day.status === "partly"
                    ? "border-accent bg-accent text-accent-foreground hover:border-primary/40"
                    : "border-border bg-card hover:border-primary/50 hover:bg-accent/40"
                )}
              >
                {day.dayOfMonth}
                {glyph}
              </Link>
            </li>
          );
        })}
      </ul>

      <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <li className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
          Free
        </li>
        <li className="inline-flex items-center gap-1.5">
          <HalfDot />
          Partly booked
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Fully booked
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-3 rounded-sm ring-2 ring-primary" />
          Today
        </li>
      </ul>
    </div>
  );
}
