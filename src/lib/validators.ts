// Zod schemas — every API boundary (server action / route) parses input
// through these before touching the database.

import { z } from "zod";

export const slugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only");

export const emailSchema = z.string().trim().toLowerCase().email();
export const phoneSchema = z.string().trim().min(5).max(30);
export const dateStrSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const timeStrSchema = z.string().regex(/^\d{2}:\d{2}$/, "HH:MM");
export const centsSchema = z.number().int().min(0).max(100_000_000);

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: z.string().min(8).max(200),
});

export const venueDetailsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  timezone: z.string().min(1),
  email: emailSchema.optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  addressLine1: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  region: z.string().trim().max(100).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().max(2).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const policiesSchema = z.object({
  depositPct: z.number().int().min(0).max(100),
  balanceDueDays: z.number().int().min(0).max(365),
  securityDepositCents: centsSchema,
  autoChargeBalance: z.boolean(),
  taxBps: z.number().int().min(0).max(3000),
  houseRules: z.string().trim().max(4000).optional().or(z.literal("")),
  cancellationTiers: z
    .array(
      z.object({
        minDaysBefore: z.number().int().min(0).max(730),
        refundPct: z.number().int().min(0).max(100),
      })
    )
    .min(1)
    .max(6),
});

export const brandingSchema = z.object({
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoUrl: z.string().url().optional().or(z.literal("")),
  photos: z.array(z.string().url()).max(20),
});

export const spaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  seatedCapacity: z.number().int().min(0).max(100_000),
  standingCapacity: z.number().int().min(0).max(100_000),
  floorAreaSqm: z.number().int().min(0).max(1_000_000).nullable().optional(),
  amenities: z.array(z.string().trim().min(1).max(60)).max(40),
  layouts: z
    .array(z.object({ name: z.string().trim().min(1).max(60), capacity: z.number().int().min(0) }))
    .max(10),
  photos: z.array(z.string().url()).max(20),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  setupBufferMins: z.number().int().min(0).max(24 * 60),
  teardownBufferMins: z.number().int().min(0).max(24 * 60),
  instantBook: z.boolean(),
});

export const ratePlanSchema = z.object({
  hourlyRateCents: centsSchema,
  minBookingHours: z.number().int().min(1).max(24),
  halfDayCents: centsSchema.nullable(),
  halfDayHours: z.number().int().min(1).max(12),
  fullDayCents: centsSchema.nullable(),
  fullDayHours: z.number().int().min(1).max(24),
  eveningCents: centsSchema.nullable(),
  eveningHours: z.number().int().min(1).max(12),
  eveningStartHour: z.number().int().min(0).max(23),
  overtimeHourlyCents: centsSchema.nullable(),
  dowMultipliers: z.array(z.number().int().min(25).max(500)).length(7),
  peakPeriods: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        startDate: dateStrSchema,
        endDate: dateStrSchema,
        multiplierPct: z.number().int().min(25).max(500),
      })
    )
    .max(20),
});

export const addOnSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  priceCents: centsSchema,
  pricingType: z.enum(["PER_UNIT", "FLAT"]),
  maxQuantity: z.number().int().min(1).max(10_000).nullable().optional(),
  active: z.boolean().default(true),
});

export const eventTypeSchema = z.enum([
  "WEDDING",
  "BIRTHDAY",
  "CONFERENCE",
  "CHURCH_PROGRAM",
  "CORPORATE",
  "OTHER",
]);
export const slotTypeSchema = z.enum(["HOURLY", "HALF_DAY", "FULL_DAY", "EVENING"]);

export const addOnSelectionSchema = z.object({
  addOnId: z.string().min(1),
  quantity: z.number().int().min(0).max(10_000),
});

/** Owner "fast phone booking" form — target: filled in under 45 seconds. */
export const phoneBookingSchema = z.object({
  clientName: z.string().trim().min(1).max(120),
  clientPhone: phoneSchema,
  clientEmail: emailSchema.optional().or(z.literal("")),
  spaceId: z.string().min(1),
  eventType: eventTypeSchema,
  slotType: slotTypeSchema,
  date: dateStrSchema,
  startTime: timeStrSchema,
  endTime: timeStrSchema,
  endsNextDay: z.boolean().default(false),
  guestCount: z.number().int().min(0).max(100_000),
  addOns: z.array(addOnSelectionSchema).default([]),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  action: z.enum(["INQUIRY", "QUOTE", "PENCIL", "CONFIRM"]),
  pencilDays: z.number().int().min(1).max(30).default(5),
});

/** Public online booking flow. */
export const onlineBookingSchema = z.object({
  spaceId: z.string().min(1),
  eventType: eventTypeSchema,
  slotType: slotTypeSchema,
  date: dateStrSchema,
  startTime: timeStrSchema,
  endTime: timeStrSchema,
  endsNextDay: z.boolean().default(false),
  guestCount: z.number().int().min(1).max(100_000),
  addOns: z.array(addOnSelectionSchema).default([]),
  clientName: z.string().trim().min(1).max(120),
  clientEmail: emailSchema,
  clientPhone: phoneSchema.optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  termsAccepted: z.literal(true),
});

export const tourRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  date: dateStrSchema,
  time: timeStrSchema,
  spaceId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const securitySettlementSchema = z.object({
  deductions: z
    .array(
      z.object({
        reason: z.string().trim().min(1).max(300),
        amountCents: centsSchema,
      })
    )
    .max(20),
});
