import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { contrastRatio, textOnColor } from "@/lib/color";
import type { CancellationTier } from "@/lib/pricing";
import { PoweredByFooter } from "@/components/public/branded-header";
import { photoList } from "@/components/public/photo";
import { BookingWizard, type WizardAddOn, type WizardSpace, type WizardVenue } from "./booking-wizard";

export const metadata: Metadata = { title: "Book online" };

const CANVAS = "#f9f7f0";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ space?: string; date?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);

  const venue = await db.venue.findUnique({
    where: { slug, published: true },
    include: {
      spaces: {
        where: { active: true, ratePlan: { isNot: null } },
        orderBy: { sortOrder: "asc" },
        include: { ratePlan: true },
      },
      addOns: { where: { active: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!venue || !venue.published) notFound();

  const wizardVenue: WizardVenue = {
    slug: venue.slug,
    name: venue.name,
    brandColor: venue.brandColor,
    currency: venue.currency,
    timezone: venue.timezone,
    depositPct: venue.depositPct,
    balanceDueDays: venue.balanceDueDays,
    securityDepositCents: venue.securityDepositCents,
    cancellationTiers: venue.cancellationTiers as unknown as CancellationTier[],
  };

  const spaces: WizardSpace[] = venue.spaces.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    photo: photoList(s.photos)[0] ?? null,
    seatedCapacity: s.seatedCapacity,
    standingCapacity: s.standingCapacity,
    amenities: ((s.amenities as string[] | null) ?? []).slice(0, 6),
    instantBook: s.instantBook,
    slotTypes: [
      "HOURLY" as const,
      ...(s.ratePlan?.halfDayCents != null ? (["HALF_DAY"] as const) : []),
      ...(s.ratePlan?.fullDayCents != null ? (["FULL_DAY"] as const) : []),
      ...(s.ratePlan?.eveningCents != null ? (["EVENING"] as const) : []),
    ],
    minBookingHours: s.ratePlan?.minBookingHours ?? 1,
    hourlyRateCents: s.ratePlan?.hourlyRateCents ?? null,
  }));

  const addOns: WizardAddOn[] = venue.addOns.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    priceCents: a.priceCents,
    pricingType: a.pricingType,
    maxQuantity: a.maxQuantity,
  }));

  const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : null;
  const initialSpaceId = spaces.some((s) => s.id === sp.space) ? sp.space! : null;

  const brand = venue.brandColor;
  // Brand colour as text only when it's readable on the canvas.
  const eyebrowColor = contrastRatio(brand, CANVAS) >= 4.5 ? brand : undefined;

  return (
    <div className="public-page flex min-h-dvh flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div aria-hidden className="h-1 w-full" style={{ backgroundColor: brand }} />
        <div className="mx-auto grid h-16 w-full max-w-2xl grid-cols-[2.75rem_1fr_2.75rem] items-center px-4 sm:px-6">
          <Link
            href={`/v/${venue.slug}`}
            aria-label={`Back to ${venue.name}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <div className="flex min-w-0 items-center justify-center gap-2.5">
            {venue.logoUrl ? (
              // External, unoptimizable URL.
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
            <span className="truncate text-base font-semibold tracking-tight text-foreground">
              {venue.name}
            </span>
          </div>
          <span aria-hidden />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="sr-only">
        <p
          className={eyebrowColor ? "text-xs font-semibold uppercase tracking-[0.14em]" : "text-xs font-semibold uppercase tracking-[0.14em] text-foreground"}
          style={eyebrowColor ? { color: eyebrowColor } : undefined}
        >
          Booking your space
        </p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[32px]">
          Plan your event
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Choose a date, space and details for {venue.name}. Live availability and transparent
          pricing at every step — your entries stay with you as you move through the booking.
        </p>
        </div>
        <div>
          <BookingWizard
            venue={wizardVenue}
            spaces={spaces}
            addOns={addOns}
            initialDate={initialDate}
            initialSpaceId={initialSpaceId}
          />
        </div>
      </main>

      <PoweredByFooter />
    </div>
  );
}
