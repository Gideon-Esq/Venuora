import Link from "next/link";
import { Eye } from "lucide-react";
import { AppShell } from "@/components/app-shell/sidebar";
import { Toaster } from "@/components/ui/toast";
import { currentUser, myVenues, requireVenue } from "@/lib/tenancy";

export default async function VenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const ctx = await requireVenue(venueSlug);
  const { venue, role } = ctx;
  const [memberships, user] = await Promise.all([myVenues(), currentUser()]);

  const venues = memberships.map((m) => ({ slug: m.venue.slug, name: m.venue.name }));
  // A super-admin impersonating has no membership; keep the current venue listed.
  if (!venues.some((v) => v.slug === venue.slug)) venues.unshift({ slug: venue.slug, name: venue.name });

  return (
    <Toaster>
      <AppShell
        venue={{ slug: venue.slug, name: venue.name, brandColor: venue.brandColor, published: venue.published, timezone: venue.timezone }}
        venues={venues}
        user={{
          name: user?.name || user?.email?.split("@")[0] || "You",
          email: user?.email ?? "",
          isSuperAdmin: user?.isSuperAdmin ?? false,
        }}
        role={role}
      >
        {ctx.impersonating && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-primary bg-primary px-4 py-2.5 text-sm text-white sm:px-8">
            <Eye className="h-4 w-4 shrink-0" aria-hidden />
            <span className="font-medium">Super-admin view of {venue.name}.</span>
            <span>Everything you do here is real and audit-logged.</span>
            <Link href="/admin" className="ml-auto font-semibold underline underline-offset-2">
              Exit to admin
            </Link>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-8 lg:px-10 lg:py-9">{children}</main>
      </AppShell>
    </Toaster>
  );
}
