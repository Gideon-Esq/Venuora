import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { myVenues, requireUser } from "@/lib/tenancy";

export const metadata = { title: "Your venues — Venuora" };

export default async function AppHomePage() {
  await requireUser();
  const memberships = await myVenues();

  if (memberships.length === 0) redirect("/app/new");
  if (memberships.length === 1) redirect(`/app/${memberships[0].venue.slug}`);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-zinc-50 px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Your venues</h1>
          <p className="mt-1 text-sm text-zinc-500">Pick a venue to manage.</p>
        </div>
        <Link
          href="/app/new"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New venue
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {memberships.map(({ venue, role }) => (
          <Link key={venue.id} href={`/app/${venue.slug}`} className="group">
            <Card className="transition-shadow group-hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <span
                  aria-hidden
                  className="h-10 w-10 shrink-0 rounded-full border border-zinc-200"
                  style={{ backgroundColor: venue.brandColor }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 group-hover:text-indigo-700">
                    {venue.name}
                  </p>
                  <p className="truncate text-sm text-zinc-500">/{venue.slug}</p>
                </div>
                <Badge className="bg-zinc-100 text-zinc-600">{role}</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
