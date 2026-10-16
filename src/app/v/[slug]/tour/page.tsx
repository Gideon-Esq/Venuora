import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { textOnColor } from "@/lib/color";
import { venueDateStr } from "@/lib/time";
import { PoweredByFooter } from "@/components/public/branded-header";
import { TourForm } from "./tour-form";

async function getVenue(slug: string) {
  const venue = await db.venue.findUnique({
    where: { slug, published: true },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      brandColor: true,
      timezone: true,
      published: true,
      email: true,
      spaces: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
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
    select: { name: true, published: true },
  });
  if (!venue || !venue.published) return { title: "Venue not found" };
  return { title: `Request a tour — ${venue.name}` };
}

export default async function TourPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const venue = await getVenue(slug);
  const venueHref = `/v/${venue.slug}`;
  const brand = venue.brandColor;

  return (
    <div className="public-page flex flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto grid h-16 w-full max-w-xl grid-cols-[44px_1fr_44px] items-center gap-2 px-2 sm:px-4">
          <Link
            href={venueHref}
            aria-label={`Back to ${venue.name}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <Link
            href={venueHref}
            className="flex min-w-0 items-center justify-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {venue.logoUrl ? (
              // Plain <img>: external, unoptimizable URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={venue.logoUrl}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold"
                style={{ backgroundColor: brand, color: textOnColor(brand) }}
              >
                {venue.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              {venue.name}
            </span>
          </Link>
          <span aria-hidden />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 pt-7 sm:px-6 sm:pt-10">
        <p className="text-sm font-medium text-primary">{venue.name}</p>
        <h1 className="mt-1 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          See {venue.name} in person
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Tell us when you would like to visit the space. We&rsquo;ll review your request and
          confirm a time by email.
        </p>
        <div className="mt-6 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_280px]"><div>
          <TourForm
            slug={venue.slug}
            venueName={venue.name}
            brandColor={brand}
            timezone={venue.timezone}
            minDate={venueDateStr(new Date(), venue.timezone)}
            spaces={venue.spaces}
          />
        </div><aside className="rounded-xl border border-border bg-card p-6 shadow-sm"><span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary"><MessageCircle className="h-5 w-5" /></span><h2 className="text-base font-semibold">Questions about a visit?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Reach out to {venue.name} and the venue team will help you plan your tour.</p>{venue.email && <a href={`mailto:${venue.email}`} className="mt-4 flex items-center gap-2 break-all text-sm text-primary"><Mail className="h-4 w-4 shrink-0" />{venue.email}</a>}</aside></div>
      </main>

      <div className="border-t border-border">
        <PoweredByFooter />
      </div>
    </div>
  );
}
