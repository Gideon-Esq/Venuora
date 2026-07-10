// Tenancy guard. EVERY owner-side page and server action resolves the
// current venue through requireVenue() — never ad-hoc queries — so
// row-level isolation is enforced in one place.

import { redirect, notFound } from "next/navigation";
import { cache } from "react";
import type { Venue, VenueRole } from "@/generated/prisma/client";
import { auth } from "./auth";
import { db } from "./db";

const ROLE_RANK: Record<VenueRole, number> = { STAFF: 0, MANAGER: 1, OWNER: 2 };

export function roleAtLeast(role: VenueRole, min: VenueRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const currentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findUnique({ where: { id: session.user.id } });
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export interface VenueContext {
  venue: Venue;
  role: VenueRole;
  userId: string;
  impersonating: boolean;
}

/**
 * Resolve venue by slug and verify the signed-in user's membership at
 * `minRole` or above. Super-admins may access any venue; every such access
 * is audit-logged as an impersonation.
 */
export async function requireVenue(
  slug: string,
  minRole: VenueRole = "STAFF"
): Promise<VenueContext> {
  const user = await requireUser();
  const venue = await db.venue.findUnique({ where: { slug } });
  if (!venue) notFound();

  const membership = await db.venueMember.findUnique({
    where: { venueId_userId: { venueId: venue.id, userId: user.id } },
  });

  if (membership && roleAtLeast(membership.role, minRole)) {
    return { venue, role: membership.role, userId: user.id, impersonating: false };
  }

  if (user.isSuperAdmin) {
    await db.auditLog.create({
      data: {
        actorUserId: user.id,
        venueId: venue.id,
        action: "IMPERSONATE",
        meta: { slug, minRole },
      },
    });
    return { venue, role: "OWNER", userId: user.id, impersonating: true };
  }

  notFound();
}

/** All venues the current user belongs to (for the venue switcher). */
export async function myVenues() {
  const user = await requireUser();
  return db.venueMember.findMany({
    where: { userId: user.id },
    include: { venue: true },
    orderBy: { venue: { name: "asc" } },
  });
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (!user.isSuperAdmin) notFound();
  return user;
}

/**
 * Venue-scoped data access for server actions: guarantees the row belongs
 * to the venue before any mutation. Throws instead of leaking cross-tenant
 * existence.
 */
export async function assertVenueRow<T extends { venueId: string }>(
  row: T | null,
  venueId: string
): Promise<T> {
  if (!row || row.venueId !== venueId) {
    throw new Error("Not found in this venue");
  }
  return row;
}
