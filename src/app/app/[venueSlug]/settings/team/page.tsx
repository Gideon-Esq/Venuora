import { Crown, Briefcase, ClipboardList, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requireVenue } from "@/lib/tenancy";
import { InviteForm } from "./invite-form";

const ROLE_STYLES: Record<string, string> = {
  OWNER: "bg-accent text-accent-foreground",
  MANAGER: "bg-sky-100 text-sky-800",
  STAFF: "bg-muted text-foreground/85",
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
  const { venue, userId } = await requireVenue(venueSlug, "OWNER");

  const members = await db.venueMember.findMany({
    where: { venueId: venue.id },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { user: { email: "asc" } },
  });

  return (
    <div className="space-y-6"><div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Team</h1><p className="mt-2 text-sm text-muted-foreground">Decide who can help manage {venue.name}.</p></div><a href="#invite-person" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white"><UserPlus className="h-4 w-4" />Invite person</a></div>
      <div className="grid gap-4 sm:grid-cols-3">{[{title:"Owner",icon:Crown,description:"Manages billing, settings, team and venue."},{title:"Manager",icon:Briefcase,description:"Manages day-to-day bookings, clients, tours and spaces."},{title:"Staff",icon:ClipboardList,description:"Views operational work and updates setup checklists."}].map(item => <Card key={item.title} className="p-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><item.icon className="h-4 w-4 text-primary" />{item.title}</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">{item.description}</p></Card>)}</div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>Who can sign in and what they can do.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden overflow-x-auto rounded-lg border border-border md:block"><table className="w-full text-left text-sm"><thead className="bg-muted text-xs uppercase text-muted-foreground"><tr>{["Person","Email","Role","Status"].map(label => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{members.map(member => <tr key={member.id}><td className="px-3 py-4 font-medium">{member.user.name ?? member.user.email}</td><td className="px-3 py-4 text-muted-foreground">{member.user.email}</td><td className="px-3 py-4">{ROLE_LABELS[member.role]}</td><td className="px-3 py-4"><Badge variant="accent">{member.userId === userId ? "You" : "Active"}</Badge></td></tr>)}</tbody></table></div><ul className="divide-y divide-border md:hidden">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {m.user.name ?? m.user.email}
                  </p>
                  {m.user.name && <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>}
                </div>
                <Badge className={ROLE_STYLES[m.role]}>{ROLE_LABELS[m.role]}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card id="invite-person">
        <CardHeader>
          <CardTitle>Invite person</CardTitle>
          <CardDescription>
            Add access for someone on your team. They can request a sign-in link using this email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InviteForm slug={venueSlug} />
          <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What each role can do</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <strong className="text-foreground">Owner</strong> — everything, including
                settings, policies, payments and billing.
              </li>
              <li>
                <strong className="text-foreground">Manager</strong> — runs the day-to-day:
                bookings, quotes, payments, spaces, clients and tours.
              </li>
              <li>
                <strong className="text-foreground">Staff</strong> — sees the calendar and
                bookings, and can tick off setup/teardown checklists.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
