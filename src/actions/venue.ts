"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, requireVenue } from "@/lib/tenancy";
import {
  createConnectAccount,
  createConnectOnboardingLink,
  createSubscriptionCheckout,
  isStripeConfigured,
} from "@/lib/stripe";
import { addDays } from "@/lib/time";
import { brandingSchema, policiesSchema, slugSchema, venueDetailsSchema } from "@/lib/validators";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function createVenueAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "America/New_York");
  if (name.length < 2) return { ok: false as const, error: "Give your venue a name" };

  let slug = slugify(name);
  if (!slugSchema.safeParse(slug).success) slug = `venue-${Date.now().toString(36)}`;
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    if (!(await db.venue.findUnique({ where: { slug: candidate } }))) {
      slug = candidate;
      break;
    }
  }

  const venue = await db.venue.create({
    data: {
      name,
      slug,
      timezone,
      trialEndsAt: addDays(new Date(), 30),
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  redirect(`/app/${venue.slug}/onboarding`);
}

export async function updateVenueDetailsAction(slug: string, formData: FormData) {
  const { venue } = await requireVenue(slug, "MANAGER");
  const parsed = venueDetailsSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    addressLine1: formData.get("addressLine1") ?? "",
    city: formData.get("city") ?? "",
    region: formData.get("region") ?? "",
    postalCode: formData.get("postalCode") ?? "",
    country: formData.get("country") || "US",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  await db.venue.update({
    where: { id: venue.id },
    data: {
      name: d.name,
      timezone: d.timezone,
      email: d.email || null,
      phone: d.phone || null,
      addressLine1: d.addressLine1 || null,
      city: d.city || null,
      region: d.region || null,
      postalCode: d.postalCode || null,
      country: d.country || "US",
      description: d.description || null,
      onboardingStep: { set: Math.max(1, venue.onboardingStep) },
    },
  });
  revalidatePath(`/app/${slug}`);
  return { ok: true as const };
}

export async function updatePoliciesAction(slug: string, input: unknown) {
  const { venue } = await requireVenue(slug, "OWNER");
  const parsed = policiesSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  await db.venue.update({
    where: { id: venue.id },
    data: {
      depositPct: d.depositPct,
      balanceDueDays: d.balanceDueDays,
      securityDepositCents: d.securityDepositCents,
      autoChargeBalance: d.autoChargeBalance,
      taxBps: d.taxBps,
      houseRules: d.houseRules || null,
      cancellationTiers: d.cancellationTiers,
      onboardingStep: { set: Math.max(5, venue.onboardingStep) },
    },
  });
  revalidatePath(`/app/${slug}`);
  return { ok: true as const };
}

export async function updateBrandingAction(slug: string, input: unknown) {
  const { venue } = await requireVenue(slug, "MANAGER");
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  await db.venue.update({
    where: { id: venue.id },
    data: {
      brandColor: parsed.data.brandColor,
      logoUrl: parsed.data.logoUrl || null,
      photos: parsed.data.photos,
    },
  });
  revalidatePath(`/app/${slug}`);
  revalidatePath(`/v/${slug}`);
  return { ok: true as const };
}

export async function connectStripeAction(slug: string): Promise<never> {
  const { venue } = await requireVenue(slug, "OWNER");
  let accountId = venue.stripeAccountId;
  if (!accountId) {
    accountId = await createConnectAccount(venue);
    await db.venue.update({
      where: { id: venue.id },
      data: {
        stripeAccountId: accountId,
        // Dev mode: mark charges enabled immediately.
        ...(isStripeConfigured() ? {} : { stripeChargesEnabled: true }),
        onboardingStep: { set: Math.max(6, venue.onboardingStep) },
      },
    });
  }
  redirect(await createConnectOnboardingLink(accountId, slug));
}

export async function publishVenueAction(slug: string) {
  const { venue } = await requireVenue(slug, "OWNER");
  const spaceCount = await db.space.count({ where: { venueId: venue.id, active: true } });
  if (spaceCount === 0) return { ok: false as const, error: "Add at least one space before publishing" };
  await db.venue.update({
    where: { id: venue.id },
    data: { published: true, onboardingStep: 99 },
  });
  revalidatePath(`/v/${slug}`);
  revalidatePath(`/app/${slug}`);
  return { ok: true as const };
}

export async function subscribeAction(slug: string, tier: "SOLO" | "GROWTH" | "PRO"): Promise<never> {
  const { venue, userId } = await requireVenue(slug, "OWNER");
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!isStripeConfigured()) {
    await db.venue.update({ where: { id: venue.id }, data: { planTier: tier } });
    redirect(`/app/${slug}/settings/billing?dev_subscribed=${tier}`);
  }
  redirect(
    await createSubscriptionCheckout({
      venueId: venue.id,
      venueSlug: slug,
      tier,
      customerEmail: user.email,
    })
  );
}

/** Dev-mode Stripe Connect return handler helper. */
export async function markDevOnboardedAction(slug: string) {
  const { venue } = await requireVenue(slug, "OWNER");
  if (!isStripeConfigured()) {
    await db.venue.update({
      where: { id: venue.id },
      data: { stripeChargesEnabled: true },
    });
  }
  revalidatePath(`/app/${slug}`);
  return { ok: true as const };
}
