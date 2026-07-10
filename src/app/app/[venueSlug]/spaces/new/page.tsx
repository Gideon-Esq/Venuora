import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireVenue } from "@/lib/tenancy";
import { SpaceForm } from "../space-form";

export default async function NewSpacePage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  await requireVenue(venueSlug, "MANAGER");

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div>
        <Link
          href={`/app/${venueSlug}/spaces`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> All spaces
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">Add a space</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Space details</CardTitle>
          <CardDescription>
            Save the basics first — you&apos;ll set the rates on the next screen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SpaceForm slug={venueSlug} spaceId={null} />
        </CardContent>
      </Card>
    </div>
  );
}
