"use server";

// Local team-management server actions. Only OWNERs may invite or change roles.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireVenue } from "@/lib/tenancy";
import { emailSchema } from "@/lib/validators";

const roleSchema = z.enum(["OWNER", "MANAGER", "STAFF"]);

export async function inviteMemberAction(slug: string, formData: FormData) {
  const { venue } = await requireVenue(slug, "OWNER");

  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { ok: false as const, error: "Enter a valid email address" };
  const role = roleSchema.safeParse(formData.get("role"));
  if (!role.success) return { ok: false as const, error: "Pick a role" };

  // Find-or-create the user. No password is set — they sign in with a magic
  // link sent to this email.
  const user = await db.user.upsert({
    where: { email: email.data },
    update: {},
    create: { email: email.data },
  });

  await db.venueMember.upsert({
    where: { venueId_userId: { venueId: venue.id, userId: user.id } },
    update: { role: role.data },
    create: { venueId: venue.id, userId: user.id, role: role.data },
  });

  revalidatePath(`/app/${slug}/settings/team`);
  return { ok: true as const };
}
