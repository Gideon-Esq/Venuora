import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PoweredByFooter } from "@/components/public/branded-header";
import { TourForm } from "./tour-form";

export const metadata: Metadata = { title: "Book a tour" };

export default async function TourPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const venue = await db.venue.findUnique({
    where: { slug },
    include: {
      spaces: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      },
    },
  });
  if (!venue || !venue.published) notFound();

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

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Book a 30-minute viewing
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Come and see {venue.name} before you commit — pick a time that suits you and the team
          will confirm.
        </p>
        <div className="mt-6">
          <TourForm slug={venue.slug} brandColor={venue.brandColor} spaces={venue.spaces} />
        </div>
      </main>

      <PoweredByFooter />
    </div>
  );
}
