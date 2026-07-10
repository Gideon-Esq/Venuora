"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { PLAN_SPACE_LIMITS } from "@/lib/stripe";
import { assertVenueRow, requireVenue } from "@/lib/tenancy";
import { addOnSchema, ratePlanSchema, spaceSchema } from "@/lib/validators";

export async function upsertSpaceAction(slug: string, spaceId: string | null, input: unknown) {
  const { venue } = await requireVenue(slug, "MANAGER");
  const parsed = spaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (!spaceId) {
    const activeCount = await db.space.count({ where: { venueId: venue.id, active: true } });
    const limit = PLAN_SPACE_LIMITS[venue.planTier] ?? 1;
    if (activeCount >= limit) {
      return { ok: false as const, error: `Your ${venue.planTier} plan allows up to ${limit} space${limit === 1 ? "" : "s"} — upgrade to add more.` };
    }
  }

  const data = {
    name: d.name,
    description: d.description || null,
    seatedCapacity: d.seatedCapacity,
    standingCapacity: d.standingCapacity,
    floorAreaSqm: d.floorAreaSqm ?? null,
    amenities: d.amenities,
    layouts: d.layouts,
    photos: d.photos,
    color: d.color,
    setupBufferMins: d.setupBufferMins,
    teardownBufferMins: d.teardownBufferMins,
    instantBook: d.instantBook,
  };

  let id = spaceId;
  if (spaceId) {
    await assertVenueRow(await db.space.findUnique({ where: { id: spaceId } }), venue.id);
    await db.space.update({ where: { id: spaceId }, data });
  } else {
    const created = await db.space.create({
      data: {
        ...data,
        venueId: venue.id,
        sortOrder: await db.space.count({ where: { venueId: venue.id } }),
      },
    });
    id = created.id;
    await db.venue.update({
      where: { id: venue.id },
      data: { onboardingStep: { set: Math.max(2, venue.onboardingStep) } },
    });
  }
  revalidatePath(`/app/${slug}/spaces`);
  revalidatePath(`/v/${slug}`);
  return { ok: true as const, spaceId: id! };
}

export async function deactivateSpaceAction(slug: string, spaceId: string) {
  const { venue } = await requireVenue(slug, "MANAGER");
  await assertVenueRow(await db.space.findUnique({ where: { id: spaceId } }), venue.id);
  await db.space.update({ where: { id: spaceId }, data: { active: false } });
  revalidatePath(`/app/${slug}/spaces`);
  revalidatePath(`/v/${slug}`);
  return { ok: true as const };
}

export async function upsertRatePlanAction(slug: string, spaceId: string, input: unknown) {
  const { venue } = await requireVenue(slug, "MANAGER");
  await assertVenueRow(await db.space.findUnique({ where: { id: spaceId } }), venue.id);
  const parsed = ratePlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const { peakPeriods, ...rates } = parsed.data;

  const ratePlan = await db.ratePlan.upsert({
    where: { spaceId },
    update: rates,
    create: { ...rates, spaceId },
  });
  await db.peakPeriod.deleteMany({ where: { ratePlanId: ratePlan.id } });
  if (peakPeriods.length) {
    await db.peakPeriod.createMany({
      data: peakPeriods.map((p) => ({ ...p, ratePlanId: ratePlan.id })),
    });
  }
  await db.venue.update({
    where: { id: venue.id },
    data: { onboardingStep: { set: Math.max(3, venue.onboardingStep) } },
  });
  revalidatePath(`/app/${slug}/spaces`);
  revalidatePath(`/v/${slug}`);
  return { ok: true as const };
}

export async function upsertAddOnAction(slug: string, addOnId: string | null, input: unknown) {
  const { venue } = await requireVenue(slug, "MANAGER");
  const parsed = addOnSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const data = {
    name: d.name,
    description: d.description || null,
    priceCents: d.priceCents,
    pricingType: d.pricingType,
    maxQuantity: d.maxQuantity ?? null,
    active: d.active,
  };
  if (addOnId) {
    await assertVenueRow(await db.addOn.findUnique({ where: { id: addOnId } }), venue.id);
    await db.addOn.update({ where: { id: addOnId }, data });
  } else {
    await db.addOn.create({
      data: {
        ...data,
        venueId: venue.id,
        sortOrder: await db.addOn.count({ where: { venueId: venue.id } }),
      },
    });
    await db.venue.update({
      where: { id: venue.id },
      data: { onboardingStep: { set: Math.max(4, venue.onboardingStep) } },
    });
  }
  revalidatePath(`/app/${slug}/addons`);
  return { ok: true as const };
}

export async function deleteAddOnAction(slug: string, addOnId: string) {
  const { venue } = await requireVenue(slug, "MANAGER");
  await assertVenueRow(await db.addOn.findUnique({ where: { id: addOnId } }), venue.id);
  await db.addOn.update({ where: { id: addOnId }, data: { active: false } });
  revalidatePath(`/app/${slug}/addons`);
  return { ok: true as const };
}
