import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireVenue } from "@/lib/tenancy";
import { CurrencySelector } from "../currency-selector";
import { SpaceForm } from "../space-form";

export default async function NewSpacePage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { role, venue } = await requireVenue(venueSlug, "MANAGER");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-start gap-2 sm:gap-3">
        <Link
          href={`/app/${venueSlug}/spaces`}
          aria-label="Back to Spaces"
          className="-ml-2 mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0">
          <h1 className="text-balance text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[32px]">
            Add a space
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Create a space guests can discover and book. You&apos;ll set the rates on the next screen.
          </p>
        </div>
      </div>

      {role === "OWNER" && <CurrencySelector slug={venueSlug} currency={venue.currency} />}
      <SpaceForm slug={venueSlug} spaceId={null} canManageBilling={role === "OWNER"} />
    </div>
  );
}
