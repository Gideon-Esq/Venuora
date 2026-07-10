"use server";

// Local server action for editing a client record. Kept in the route folder
// per convention — it still goes through requireVenue + assertVenueRow.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertVenueRow, requireVenue } from "@/lib/tenancy";
import { emailSchema } from "@/lib/validators";

const clientEditSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: emailSchema.optional().or(z.literal("")),
  organization: z.string().trim().max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function updateClientAction(
  slug: string,
  clientId: string,
  input: unknown
) {
  const { venue } = await requireVenue(slug, "MANAGER");
  const parsed = clientEditSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }
  await assertVenueRow(await db.client.findUnique({ where: { id: clientId } }), venue.id);
  const d = parsed.data;
  await db.client.update({
    where: { id: clientId },
    data: {
      name: d.name,
      phone: d.phone || null,
      email: d.email || null,
      organization: d.organization || null,
      notes: d.notes || null,
    },
  });
  revalidatePath(`/app/${slug}/clients`);
  revalidatePath(`/app/${slug}/clients/${clientId}`);
  return { ok: true as const };
}
