"use server";

import { db } from "@/lib/db";

export async function searchVenues(location: string, guests: number) {
  const venues = await db.venue.findMany({
    where: {
      published: true,
      ...(location.trim() ? { OR: [
        { city: { contains: location.trim().slice(0, 100), mode: "insensitive" as const } },
        { name: { contains: location.trim().slice(0, 100), mode: "insensitive" as const } },
        { region: { contains: location.trim().slice(0, 100), mode: "insensitive" as const } },
      ] } : {}),
      spaces: { some: { active: true, ...(guests > 0 && Number.isFinite(guests) ? { OR: [{ seatedCapacity: { gte: guests } }, { standingCapacity: { gte: guests } }] } : {}) } },
    },
    select: { name: true, slug: true, city: true, photos: true },
    orderBy: { name: "asc" }, take: 30,
  });
  return venues.map(v => ({ name: v.name, slug: v.slug, city: v.city, photo: Array.isArray(v.photos) ? v.photos.find((p): p is string => typeof p === "string" && /^https?:\/\//.test(p)) ?? null : null }));
}
