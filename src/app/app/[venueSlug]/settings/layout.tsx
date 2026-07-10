import { requireVenue } from "@/lib/tenancy";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  await requireVenue(venueSlug, "OWNER");

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500">
          Your venue&apos;s details, policies and payments — all in one place.
        </p>
      </div>
      <SettingsNav slug={venueSlug} />
      {children}
    </div>
  );
}
