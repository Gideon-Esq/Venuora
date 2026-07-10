import Link from "next/link";
import { AlertTriangle, ArrowRight, Eye } from "lucide-react";
import { AppSidebar } from "@/components/app-shell/sidebar";
import { myVenues, requireVenue } from "@/lib/tenancy";

export default async function VenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const ctx = await requireVenue(venueSlug);
  const { venue } = ctx;
  const memberships = await myVenues();

  return (
    <div className="min-h-screen bg-zinc-50">
      <AppSidebar
        venue={{
          slug: venue.slug,
          name: venue.name,
          brandColor: venue.brandColor,
          published: venue.published,
        }}
        venues={memberships.map((m) => ({ slug: m.venue.slug, name: m.venue.name }))}
      />

      <div className="lg:pl-64">
        {ctx.impersonating && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 sm:px-6">
            <Eye className="h-4 w-4 shrink-0" />
            Viewing as super-admin — this access is audit-logged.
          </div>
        )}

        {venue.onboardingStep < 99 && (
          <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-2.5 sm:px-6">
            <Link
              href={`/app/${venue.slug}/onboarding`}
              className="group flex items-center gap-2 text-sm text-indigo-800"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-indigo-500" />
              <span>
                <span className="font-medium">Setup incomplete.</span> Finish onboarding to
                publish your venue and take bookings online.
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
