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
  if (tour.status === status) return { ok: true as const };
  const allowed = tour.status === "PENDING" ? ["CONFIRMED", "DECLINED", "CANCELLED"] : tour.status === "CONFIRMED" ? ["COMPLETED", "CANCELLED"] : [];
  if (!allowed.includes(status)) throw new Error("This tour is closed or no longer supports that change.");
  const updated = await db.tourRequest.updateMany({ where: { id: tourId, venueId: venue.id, status: tour.status }, data: { status } });
  if (updated.count !== 1) throw new Error("This tour changed. Refresh and try again.");
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

/** Log a visit from the venue workspace; tours never create calendar bookings. */
export async function createTourAction(slug: string, input: unknown) {
  const { venue } = await requireVenue(slug, "MANAGER");
  const { tourRequestSchema } = await import("@/lib/validators");
  const { venueLocalToUtc } = await import("@/lib/time");
  const parsed = tourRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const data = parsed.data;
  if (data.spaceId) await assertVenueRow(await db.space.findFirst({ where: { id: data.spaceId, venueId: venue.id, active: true } }), venue.id);
  const requestedAt = venueLocalToUtc(venue.timezone, data.date, data.time);
  if (requestedAt <= new Date()) return { ok: false as const, error: "Choose a future date and time." };
  await db.tourRequest.create({ data: { venueId: venue.id, name: data.name, email: data.email, phone: data.phone || null, spaceId: data.spaceId || null, requestedAt, notes: data.notes || null, status: "PENDING" } });
  revalidatePath(`/app/${slug}/tours`);
  revalidatePath(`/app/${slug}`);
  return { ok: true as const };
}
