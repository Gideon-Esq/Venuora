import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requireVenue } from "@/lib/tenancy";
import { InviteForm } from "./invite-form";

const ROLE_STYLES: Record<string, string> = {
  OWNER: "bg-indigo-100 text-indigo-700",
  MANAGER: "bg-sky-100 text-sky-800",
  STAFF: "bg-zinc-100 text-zinc-700",
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
};

export default async function TeamSettingsPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "OWNER");

  const members = await db.venueMember.findMany({
    where: { venueId: venue.id },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { user: { email: "asc" } },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>Who can sign in and what they can do.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-zinc-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">
                    {m.user.name ?? m.user.email}
                  </p>
                  {m.user.name && <p className="truncate text-xs text-zinc-500">{m.user.email}</p>}
                </div>
                <Badge className={ROLE_STYLES[m.role]}>{ROLE_LABELS[m.role]}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite someone</CardTitle>
          <CardDescription>
            They&apos;ll sign in with a magic link sent to their email — no password to set up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InviteForm slug={venueSlug} />
          <div className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-600">
            <p className="font-medium text-zinc-900">What each role can do</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <strong className="text-zinc-800">Owner</strong> — everything, including
                settings, policies, payments and billing.
              </li>
              <li>
                <strong className="text-zinc-800">Manager</strong> — runs the day-to-day:
                bookings, quotes, payments, spaces, clients and tours.
              </li>
              <li>
                <strong className="text-zinc-800">Staff</strong> — sees the calendar and
                bookings, and can tick off setup/teardown checklists.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
