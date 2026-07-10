"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { tourConfirmedEmail } from "@/lib/email-templates";
import { brandOf } from "@/lib/payments";
import { assertVenueRow, requireVenue } from "@/lib/tenancy";

export async function setTourStatusAction(
  slug: string,
  tourId: string,
  status: "CONFIRMED" | "DECLINED" | "COMPLETED" | "CANCELLED"
) {
  const { venue } = await requireVenue(slug, "MANAGER");
  const tour = await assertVenueRow(
    await db.tourRequest.findUnique({ where: { id: tourId } }),
    venue.id
  );
  await db.tourRequest.update({ where: { id: tourId }, data: { status } });
  if (status === "CONFIRMED") {
    const email = tourConfirmedEmail(brandOf(venue), {
      name: tour.name,
      requestedAt: tour.requestedAt,
    });
    await sendEmail({ to: tour.email, ...email, replyTo: venue.email ?? undefined });
  }
  revalidatePath(`/app/${slug}/tours`);
  return { ok: true as const };
}
