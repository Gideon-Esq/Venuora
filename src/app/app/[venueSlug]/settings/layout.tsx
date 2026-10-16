import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireVenue } from "@/lib/tenancy";
import { Lock } from "lucide-react";
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
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            Settings
            <Badge variant="accent" className="px-2.5 py-1 text-[13px]">
              <Lock aria-hidden />
              Owner only
            </Badge>
          </span>
        }
        description="Manage your venue settings and account preferences."
      />
      <div className="grid gap-6 lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-8">
        <SettingsNav slug={venueSlug} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
