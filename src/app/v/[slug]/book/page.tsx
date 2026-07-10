import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import type { CancellationTier } from "@/lib/pricing";
import { PoweredByFooter } from "@/components/public/branded-header";
import { photoList } from "@/components/public/photo";
import { BookingWizard, type WizardAddOn, type WizardSpace, type WizardVenue } from "./booking-wizard";

export const metadata: Metadata = { title: "Book online" };

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ space?: string; date?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);

  const venue = await db.venue.findUnique({
    where: { slug },
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

  return (
    <div className="public-page flex flex-1 flex-col bg-zinc-50">
      <div aria-hidden className="h-1.5 w-full" style={{ backgroundColor: venue.brandColor }} />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <span className="text-base font-semibold tracking-tight text-zinc-900">
            {venue.name}
          </span>
          <Link
            href={`/v/${venue.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to venue
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Book {venue.name}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Check live availability, see transparent pricing and secure your date.
        </p>
        <div className="mt-6">
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
