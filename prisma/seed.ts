// Demo seed: "The Regency Event Center" — 3 spaces, weekend premiums,
// December peak season, add-ons catalog, ~90 days of realistic bookings
// including a fully-booked Saturday. Run: npm run db:seed
//
// Sign in afterwards:
//   owner@regency.demo    / demo1234   (venue owner)
//   manager@regency.demo  / demo1234   (manager)
//   admin@venuora.demo    / demo1234   (platform super-admin)

import "dotenv/config";
import { hashSync } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computeDeposit, priceBooking, type AddOnSelection } from "../src/lib/pricing";
import { toRatePlanInput } from "../src/lib/booking-helpers";
import { venueLocalToUtc, addDays } from "../src/lib/time";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TZ = "America/New_York";

// Deterministic PRNG so the demo looks the same on every reseed.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260710);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

function localDateStr(daysFromToday: number): string {
  const d = new Date(Date.now() + daysFromToday * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD
}
function dowOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

async function main() {
  console.log("🌱 Seeding The Regency Event Center…");

  // Wipe (dev only!)
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.webhookEvent.deleteMany(),
    db.payment.deleteMany(),
    db.quote.deleteMany(),
    db.booking.deleteMany(),
    db.tourRequest.deleteMany(),
    db.client.deleteMany(),
    db.peakPeriod.deleteMany(),
    db.ratePlan.deleteMany(),
    db.addOn.deleteMany(),
    db.space.deleteMany(),
    db.venueMember.deleteMany(),
    db.venue.deleteMany(),
    db.session.deleteMany(),
    db.account.deleteMany(),
    db.verificationToken.deleteMany(),
    db.user.deleteMany(),
  ]);

  const password = hashSync("demo1234", 10);
  const owner = await db.user.create({
    data: { email: "owner@regency.demo", name: "Grace Adeyemi", passwordHash: password, emailVerified: new Date() },
  });
  const manager = await db.user.create({
    data: { email: "manager@regency.demo", name: "Sam Okafor", passwordHash: password, emailVerified: new Date() },
  });
  await db.user.create({
    data: { email: "admin@venuora.demo", name: "Venuora Admin", passwordHash: password, isSuperAdmin: true, emailVerified: new Date() },
  });

  const decemberYear = new Date().getMonth() === 11 ? new Date().getFullYear() : new Date().getFullYear();
  const venue = await db.venue.create({
    data: {
      slug: "regency-event-center",
      name: "The Regency Event Center",
      timezone: TZ,
      currency: "usd",
      email: "events@regency.demo",
      phone: "+1 (555) 812-4400",
      addressLine1: "1200 Grand Avenue",
      city: "Atlanta",
      region: "GA",
      postalCode: "30303",
      country: "US",
      description:
        "Atlanta's home for weddings, galas and conferences. Three beautiful spaces, on-site parking for 200 cars, full AV, and a team that has hosted over a thousand events.",
      brandColor: "#4338ca",
      photos: [
        "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1600&q=80",
        "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1600&q=80",
        "https://images.unsplash.com/photo-1511578314322-379afb476865?w=1600&q=80",
        "https://images.unsplash.com/photo-1478146896981-b80fe463b330?w=1600&q=80",
      ],
      operatingHours: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow, open: "08:00", close: "01:00", closed: false })),
      cancellationTiers: [
        { minDaysBefore: 60, refundPct: 100 },
        { minDaysBefore: 30, refundPct: 50 },
        { minDaysBefore: 0, refundPct: 0 },
      ],
      depositPct: 30,
      balanceDueDays: 14,
      securityDepositCents: 50_000,
      autoChargeBalance: false,
      houseRules:
        "Music ends at midnight. No confetti or open flames. Outside catering welcome with kitchen access add-on. All vendors must load out by 1:00 AM.",
      taxBps: 750,
      planTier: "GROWTH",
      trialEndsAt: addDays(new Date(), 30),
      stripeAccountId: "acct_dev_regency",
      stripeChargesEnabled: true,
      published: true,
      onboardingStep: 99,
      members: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: manager.id, role: "MANAGER" },
        ],
      },
    },
  });

  // --- Spaces & rates -------------------------------------------------------
  const ballroom = await db.space.create({
    data: {
      venueId: venue.id,
      name: "The Grand Ballroom",
      description:
        "Our flagship space: 6m ceilings, crystal chandeliers, built-in stage and a sprung dance floor. Seats 300 banquet-style.",
      photos: [
        "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1600&q=80",
        "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1600&q=80",
      ],
      seatedCapacity: 300,
      standingCapacity: 450,
      floorAreaSqm: 620,
      amenities: ["Stage", "Sound system", "Projector & screen", "Kitchen access", "Parking", "Changing rooms", "Generator / backup power", "Air conditioning", "Dance floor"],
      layouts: [
        { name: "Banquet", capacity: 300 },
        { name: "Theatre", capacity: 450 },
        { name: "Classroom", capacity: 220 },
      ],
      color: "#6366f1",
      sortOrder: 0,
      setupBufferMins: 90,
      teardownBufferMins: 90,
      instantBook: false, // weddings are vetted: inquiry-first
      ratePlan: {
        create: {
          hourlyRateCents: 25_000,
          minBookingHours: 4,
          halfDayCents: 150_000,
          halfDayHours: 5,
          fullDayCents: 300_000,
          fullDayHours: 12,
          eveningCents: 200_000,
          eveningHours: 6,
          overtimeHourlyCents: 30_000,
          dowMultipliers: [110, 100, 100, 100, 100, 125, 150],
          peakPeriods: {
            create: [
              { name: "December peak season", startDate: `${decemberYear}-12-15`, endDate: `${decemberYear}-12-31`, multiplierPct: 140 },
            ],
          },
        },
      },
    },
  });

  const pavilion = await db.space.create({
    data: {
      venueId: venue.id,
      name: "Garden Pavilion",
      description:
        "A light-filled glass pavilion opening onto landscaped gardens — magical for ceremonies, cocktail hours and birthday parties.",
      photos: [
        "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1600&q=80",
        "https://images.unsplash.com/photo-1522413452208-996ff3f3e740?w=1600&q=80",
      ],
      seatedCapacity: 120,
      standingCapacity: 180,
      floorAreaSqm: 260,
      amenities: ["Sound system", "Parking", "Outdoor area", "Air conditioning", "WiFi"],
      layouts: [
        { name: "Banquet", capacity: 120 },
        { name: "Theatre", capacity: 180 },
      ],
      color: "#10b981",
      sortOrder: 1,
      setupBufferMins: 45,
      teardownBufferMins: 45,
      instantBook: true,
      ratePlan: {
        create: {
          hourlyRateCents: 12_000,
          minBookingHours: 3,
          halfDayCents: 70_000,
          halfDayHours: 5,
          fullDayCents: 130_000,
          fullDayHours: 12,
          eveningCents: 90_000,
          eveningHours: 6,
          overtimeHourlyCents: 15_000,
          dowMultipliers: [110, 100, 100, 100, 100, 125, 150],
          peakPeriods: {
            create: [
              { name: "December peak season", startDate: `${decemberYear}-12-15`, endDate: `${decemberYear}-12-31`, multiplierPct: 140 },
            ],
          },
        },
      },
    },
  });

  const boardroom = await db.space.create({
    data: {
      venueId: venue.id,
      name: "The Boardroom",
      description:
        "A polished 40-seat meeting room with 4K screen, conference audio and all-day coffee — perfect for offsites and trainings.",
      photos: ["https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=1600&q=80"],
      seatedCapacity: 40,
      standingCapacity: 60,
      floorAreaSqm: 85,
      amenities: ["Projector & screen", "WiFi", "Air conditioning", "Parking", "Wheelchair accessible"],
      layouts: [
        { name: "Boardroom", capacity: 24 },
        { name: "Classroom", capacity: 30 },
        { name: "Theatre", capacity: 40 },
      ],
      color: "#f59e0b",
      sortOrder: 2,
      setupBufferMins: 15,
      teardownBufferMins: 15,
      instantBook: true,
      ratePlan: {
        create: {
          hourlyRateCents: 6_000,
          minBookingHours: 2,
          halfDayCents: 25_000,
          halfDayHours: 5,
          fullDayCents: 45_000,
          fullDayHours: 10,
          eveningCents: 30_000,
          eveningHours: 5,
          overtimeHourlyCents: 7_500,
          dowMultipliers: [100, 100, 100, 100, 100, 100, 100],
          peakPeriods: { create: [] },
        },
      },
    },
  });

  // --- Add-ons ---------------------------------------------------------------
  const addOnRows = [
    { name: "Chiavari chairs", priceCents: 250, pricingType: "PER_UNIT", maxQuantity: 450, description: "Gold chiavari chairs with cushion" },
    { name: "Round tables (10-seat)", priceCents: 800, pricingType: "PER_UNIT", maxQuantity: 45 },
    { name: "Table linens", priceCents: 400, pricingType: "PER_UNIT", maxQuantity: 60, description: "Floor-length, white or ivory" },
    { name: "Stage extension", priceCents: 15_000, pricingType: "FLAT" },
    { name: "Premium sound system + engineer", priceCents: 20_000, pricingType: "FLAT" },
    { name: "Projector & 4m screen", priceCents: 7_500, pricingType: "FLAT" },
    { name: "Deep-clean fee", priceCents: 10_000, pricingType: "FLAT", description: "Required for events over 150 guests" },
    { name: "Security personnel", priceCents: 12_000, pricingType: "PER_UNIT", maxQuantity: 6, description: "Per guard, per event" },
    { name: "Decoration package", priceCents: 50_000, pricingType: "FLAT", description: "Uplighting, draping and centerpieces" },
    { name: "Kitchen access (outside catering)", priceCents: 17_500, pricingType: "FLAT" },
  ] as const;
  const addOns: Awaited<ReturnType<typeof db.addOn.create>>[] = [];
  for (let i = 0; i < addOnRows.length; i++) {
    const a = addOnRows[i];
    addOns.push(
      await db.addOn.create({
        data: {
          venueId: venue.id,
          name: a.name,
          priceCents: a.priceCents,
          pricingType: a.pricingType,
          maxQuantity: "maxQuantity" in a ? a.maxQuantity : null,
          description: "description" in a ? a.description : null,
          sortOrder: i,
        },
      })
    );
  }

  // --- Clients ----------------------------------------------------------------
  const clientSeed = [
    ["Amara & David Johnson", "amara.johnson@example.com", "+1 (555) 210-3341", null],
    ["Pastor Emmanuel Cole", "office@gracechapel.example.com", "+1 (555) 448-2210", "Grace Chapel International"],
    ["Tunde Bakare", "tunde.b@example.com", "+1 (555) 902-1178", null],
    ["Meridian Consulting", "events@meridian.example.com", "+1 (555) 300-7845", "Meridian Consulting LLC"],
    ["Sarah Mitchell", "sarah.mitchell@example.com", "+1 (555) 671-9902", null],
    ["Chinwe Okoro", "chinwe.okoro@example.com", "+1 (555) 233-8874", null],
    ["Atlanta Tech Circle", "hello@atltech.example.com", "+1 (555) 415-6620", "Atlanta Tech Circle"],
    ["The Ramirez Family", "l.ramirez@example.com", "+1 (555) 782-3319", null],
    ["Kofi Mensah", "kofi.mensah@example.com", "+1 (555) 190-4452", null],
    ["Bright Path Academy", "admin@brightpath.example.com", "+1 (555) 640-2287", "Bright Path Academy"],
    ["Janelle Thompson", "janelle.t@example.com", "+1 (555) 356-7741", null],
    ["Rotary Club Midtown", "midtown@rotary.example.com", "+1 (555) 528-9963", "Rotary Club"],
    ["Efe & Osaze Idahosa", "efe.idahosa@example.com", "+1 (555) 803-5510", null],
    ["Hallmark HR Summit", "summit@hallmarkhr.example.com", "+1 (555) 977-1204", "Hallmark HR"],
    ["Monique Carter", "monique.c@example.com", "+1 (555) 262-8830", null],
  ] as const;
  const clients: Awaited<ReturnType<typeof db.client.create>>[] = [];
  for (const [name, email, phone, organization] of clientSeed) {
    clients.push(
      await db.client.create({ data: { venueId: venue.id, name, email, phone, organization } })
    );
  }

  // --- Bookings ---------------------------------------------------------------
  const spaces = { ballroom, pavilion, boardroom };
  type SpaceKey = keyof typeof spaces;

  const spaceWithRates = async (id: string) =>
    db.space.findUniqueOrThrow({ where: { id }, include: { ratePlan: { include: { peakPeriods: true } } } });

  const eventTypesBySpace: Record<SpaceKey, ("WEDDING" | "BIRTHDAY" | "CONFERENCE" | "CHURCH_PROGRAM" | "CORPORATE" | "OTHER")[]> = {
    ballroom: ["WEDDING", "WEDDING", "CHURCH_PROGRAM", "CORPORATE", "BIRTHDAY"],
    pavilion: ["BIRTHDAY", "WEDDING", "OTHER", "CHURCH_PROGRAM"],
    boardroom: ["CONFERENCE", "CORPORATE", "CORPORATE", "OTHER"],
  };

  let created = 0;
  let skipped = 0;

  async function seedBooking(args: {
    spaceKey: SpaceKey;
    dayOffset: number;
    startTime: string;
    endTime: string;
    endsNextDay?: boolean;
    slotType: "HOURLY" | "HALF_DAY" | "FULL_DAY" | "EVENING";
    status: "INQUIRY" | "QUOTE_SENT" | "PENCILED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
    client?: (typeof clients)[number];
    eventType?: (typeof eventTypesBySpace)[SpaceKey][number];
    guestCount?: number;
    withAddOns?: boolean;
    paid?: "NONE" | "DEPOSIT" | "FULL" | "FULL_PLUS_SECURITY";
    notes?: string;
  }) {
    const space = await spaceWithRates(spaces[args.spaceKey].id);
    const dateStr = localDateStr(args.dayOffset);
    const start = venueLocalToUtc(TZ, dateStr, args.startTime);
    let end = venueLocalToUtc(TZ, dateStr, args.endTime);
    if (args.endsNextDay || end <= start) {
      end = new Date(venueLocalToUtc(TZ, dateStr, args.endTime).getTime() + 86_400_000);
    }

    const selections: AddOnSelection[] = args.withAddOns
      ? [
          { name: addOns[0].name, pricingType: "PER_UNIT", unitCents: addOns[0].priceCents, quantity: Math.min(args.guestCount ?? 100, 300) },
          { name: addOns[1].name, pricingType: "PER_UNIT", unitCents: addOns[1].priceCents, quantity: Math.ceil((args.guestCount ?? 100) / 10) },
          ...(rand() > 0.5 ? [{ name: addOns[8].name, pricingType: "FLAT" as const, unitCents: addOns[8].priceCents, quantity: 1 }] : []),
          ...(rand() > 0.6 ? [{ name: addOns[4].name, pricingType: "FLAT" as const, unitCents: addOns[4].priceCents, quantity: 1 }] : []),
        ]
      : [];

    const quote = priceBooking({
      spaceName: space.name,
      ratePlan: toRatePlanInput(space.ratePlan!),
      slotType: args.slotType,
      start,
      end,
      timezone: TZ,
      addOns: selections,
      taxBps: venue.taxBps,
    });
    const depositCents = computeDeposit(quote.totalCents, venue.depositPct);
    const client = args.client ?? pick(clients);
    const eventType = args.eventType ?? pick(eventTypesBySpace[args.spaceKey]);
    const blocking = ["PENCILED", "CONFIRMED", "COMPLETED", "NO_SHOW"].includes(args.status);

    try {
      const booking = await db.booking.create({
        data: {
          venueId: venue.id,
          spaceId: space.id,
          clientId: client.id,
          status: args.status,
          source: args.status === "INQUIRY" && rand() > 0.5 ? "ONLINE" : pick(["PHONE", "WHATSAPP", "ONLINE", "PHONE"] as const),
          eventType,
          slotType: args.slotType,
          start,
          end,
          setupBufferMins: space.setupBufferMins,
          teardownBufferMins: space.teardownBufferMins,
          blockedStart: new Date(start.getTime() - space.setupBufferMins * 60_000),
          blockedEnd: new Date(end.getTime() + space.teardownBufferMins * 60_000),
          guestCount: args.guestCount ?? Math.floor(40 + rand() * (space.seatedCapacity - 40)),
          lineItems: quote.lineItems as object[],
          subtotalCents: quote.subtotalCents,
          taxCents: quote.taxCents,
          totalCents: quote.totalCents,
          depositCents,
          securityDepositCents: args.spaceKey === "boardroom" ? 0 : venue.securityDepositCents,
          balanceDueDate: addDays(start, -venue.balanceDueDays),
          holdExpiresAt: args.status === "PENCILED" ? addDays(new Date(), 2 + Math.floor(rand() * 5)) : null,
          notes: args.notes ?? null,
          ...(args.status === "CANCELLED" ? { cancelledAt: addDays(new Date(), -3), cancelReason: "Change of plans" } : {}),
          ...(args.status === "COMPLETED" ? { setupDone: true, eventDone: true } : {}),
        },
      });

      const paid = args.paid ?? (args.status === "CONFIRMED" ? "DEPOSIT" : args.status === "COMPLETED" ? "FULL_PLUS_SECURITY" : "NONE");
      if (paid !== "NONE") {
        await db.payment.create({
          data: {
            venueId: venue.id, bookingId: booking.id, type: "BOOKING_DEPOSIT", status: "SUCCEEDED",
            amountCents: depositCents, currency: "usd", stripePaymentIntentId: `pi_dev_seed_${booking.id.slice(-8)}d`,
            createdAt: addDays(start, -45),
          },
        });
      }
      if (paid === "FULL" || paid === "FULL_PLUS_SECURITY") {
        await db.payment.create({
          data: {
            venueId: venue.id, bookingId: booking.id, type: "BALANCE", status: "SUCCEEDED",
            amountCents: quote.totalCents - depositCents, currency: "usd", stripePaymentIntentId: `pi_dev_seed_${booking.id.slice(-8)}b`,
            createdAt: addDays(start, -venue.balanceDueDays),
          },
        });
      }
      if (paid === "FULL_PLUS_SECURITY" && booking.securityDepositCents > 0) {
        await db.payment.create({
          data: {
            venueId: venue.id, bookingId: booking.id, type: "SECURITY_DEPOSIT", status: "SUCCEEDED",
            amountCents: booking.securityDepositCents, currency: "usd", stripePaymentIntentId: `pi_dev_seed_${booking.id.slice(-8)}s`,
            createdAt: addDays(start, -venue.balanceDueDays),
          },
        });
        if (args.status === "COMPLETED") {
          // Most get a full refund; some have a deduction story.
          const deduction = rand() > 0.75 ? 7_500 : 0;
          await db.payment.create({
            data: {
              venueId: venue.id, bookingId: booking.id, type: "SECURITY_REFUND", status: "SUCCEEDED",
              amountCents: booking.securityDepositCents - deduction, currency: "usd",
              stripeRefundId: `re_dev_seed_${booking.id.slice(-8)}`,
              reason: deduction ? "Extra cleaning: red wine on carpet" : "Full refund — no deductions",
              createdAt: addDays(end, 3),
            },
          });
        }
      }
      if (args.status === "QUOTE_SENT") {
        const last = await db.quote.findFirst({ where: { venueId: venue.id }, orderBy: { number: "desc" } });
        await db.quote.create({
          data: {
            venueId: venue.id, bookingId: booking.id, number: (last?.number ?? 1000) + 1,
            validUntil: addDays(new Date(), 14), terms: venue.houseRules, sentAt: new Date(),
          },
        });
      }
      if (args.status === "CANCELLED" && paid !== "NONE") {
        await db.payment.create({
          data: {
            venueId: venue.id, bookingId: booking.id, type: "REFUND", status: "SUCCEEDED",
            amountCents: Math.round(depositCents / 2), currency: "usd",
            stripeRefundId: `re_dev_seed_${booking.id.slice(-8)}c`, reason: "Cancellation: 50% tier",
          },
        });
      }
      created++;
      return booking;
    } catch (err) {
      // Slot collision with an earlier seeded booking — fine, skip it.
      if (String(err).includes("booking_no_double_booking")) {
        skipped++;
        return null;
      }
      throw err;
    }
  }

  // Past 30 days: completed events (weekend-heavy) --------------------------
  for (let d = -30; d < -1; d++) {
    const dow = dowOf(localDateStr(d));
    if (dow === 6) {
      await seedBooking({ spaceKey: "ballroom", dayOffset: d, startTime: "17:00", endTime: "23:00", slotType: "EVENING", status: "COMPLETED", withAddOns: true, paid: "FULL_PLUS_SECURITY" });
      await seedBooking({ spaceKey: "pavilion", dayOffset: d, startTime: "11:00", endTime: "16:00", slotType: "HALF_DAY", status: "COMPLETED", paid: "FULL_PLUS_SECURITY" });
    } else if (dow === 5) {
      await seedBooking({ spaceKey: "pavilion", dayOffset: d, startTime: "18:00", endTime: "23:00", slotType: "EVENING", status: "COMPLETED", paid: "FULL_PLUS_SECURITY" });
    } else if (dow === 0 && rand() > 0.3) {
      await seedBooking({ spaceKey: "ballroom", dayOffset: d, startTime: "09:00", endTime: "14:00", slotType: "HALF_DAY", status: "COMPLETED", eventType: "CHURCH_PROGRAM", client: clients[1], paid: "FULL_PLUS_SECURITY" });
    } else if ((dow === 2 || dow === 4) && rand() > 0.45) {
      await seedBooking({ spaceKey: "boardroom", dayOffset: d, startTime: "09:00", endTime: "17:00", slotType: "FULL_DAY", status: "COMPLETED", paid: "FULL" });
    }
  }
  // One recent no-show for realism.
  await seedBooking({ spaceKey: "boardroom", dayOffset: -6, startTime: "18:00", endTime: "21:00", slotType: "HOURLY", status: "NO_SHOW", paid: "DEPOSIT" });

  // Next 60 days: confirmed pipeline ----------------------------------------
  for (let d = 2; d < 60; d++) {
    const dow = dowOf(localDateStr(d));
    if (dow === 6 && rand() > 0.25) {
      await seedBooking({ spaceKey: "ballroom", dayOffset: d, startTime: "17:00", endTime: "23:00", slotType: "EVENING", status: "CONFIRMED", withAddOns: true, paid: d < 16 ? "FULL_PLUS_SECURITY" : "DEPOSIT" });
      if (rand() > 0.5) await seedBooking({ spaceKey: "pavilion", dayOffset: d, startTime: "12:00", endTime: "17:00", slotType: "HALF_DAY", status: "CONFIRMED", paid: "DEPOSIT" });
    }
    if (dow === 5 && rand() > 0.55) {
      await seedBooking({ spaceKey: "pavilion", dayOffset: d, startTime: "18:00", endTime: "23:00", slotType: "EVENING", status: "CONFIRMED", paid: "DEPOSIT" });
    }
    if (dow === 0 && rand() > 0.4) {
      await seedBooking({ spaceKey: "ballroom", dayOffset: d, startTime: "09:00", endTime: "14:00", slotType: "HALF_DAY", status: "CONFIRMED", eventType: "CHURCH_PROGRAM", client: clients[1], paid: "DEPOSIT" });
    }
    if ((dow === 1 || dow === 3) && rand() > 0.6) {
      await seedBooking({ spaceKey: "boardroom", dayOffset: d, startTime: "09:00", endTime: "17:00", slotType: "FULL_DAY", status: "CONFIRMED", paid: "DEPOSIT" });
    }
  }

  // THE fully-booked Saturday (~16 days out): every space confirmed, evening
  // wedding crossing midnight in the ballroom.
  let fullSat = 12;
  while (dowOf(localDateStr(fullSat)) !== 6) fullSat++;
  await seedBooking({
    spaceKey: "ballroom", dayOffset: fullSat, startTime: "18:00", endTime: "00:30", endsNextDay: true,
    slotType: "EVENING", status: "CONFIRMED", eventType: "WEDDING", client: clients[0],
    guestCount: 280, withAddOns: true, paid: "FULL_PLUS_SECURITY",
    notes: "Johnson wedding — gold & ivory theme. Band arrives 15:30 for soundcheck.",
  });
  await seedBooking({
    spaceKey: "ballroom", dayOffset: fullSat, startTime: "09:00", endTime: "13:00",
    slotType: "HOURLY", status: "CONFIRMED", eventType: "CORPORATE", client: clients[13],
    guestCount: 180, paid: "FULL",
  });
  await seedBooking({
    spaceKey: "pavilion", dayOffset: fullSat, startTime: "10:00", endTime: "15:00",
    slotType: "HALF_DAY", status: "CONFIRMED", eventType: "BIRTHDAY", client: clients[7],
    guestCount: 90, paid: "DEPOSIT",
  });
  await seedBooking({
    spaceKey: "pavilion", dayOffset: fullSat, startTime: "17:30", endTime: "22:30",
    slotType: "EVENING", status: "CONFIRMED", eventType: "BIRTHDAY", client: clients[10],
    guestCount: 110, paid: "DEPOSIT",
  });
  await seedBooking({
    spaceKey: "boardroom", dayOffset: fullSat, startTime: "09:00", endTime: "18:00",
    slotType: "FULL_DAY", status: "CONFIRMED", eventType: "CONFERENCE", client: clients[6],
    guestCount: 38, paid: "FULL",
  });

  // Live pipeline: inquiries, quotes, penciled holds -------------------------
  await seedBooking({ spaceKey: "ballroom", dayOffset: 21, startTime: "17:00", endTime: "23:00", slotType: "EVENING", status: "PENCILED", eventType: "WEDDING", client: clients[12], guestCount: 220, notes: "Held until Friday — deciding between us and Piedmont Hall." });
  await seedBooking({ spaceKey: "pavilion", dayOffset: 33, startTime: "12:00", endTime: "17:00", slotType: "HALF_DAY", status: "PENCILED", client: clients[9], guestCount: 100 });
  await seedBooking({ spaceKey: "ballroom", dayOffset: 45, startTime: "17:00", endTime: "23:00", slotType: "EVENING", status: "QUOTE_SENT", eventType: "WEDDING", client: clients[5], guestCount: 250, withAddOns: true });
  await seedBooking({ spaceKey: "boardroom", dayOffset: 18, startTime: "09:00", endTime: "13:00", slotType: "HOURLY", status: "QUOTE_SENT", eventType: "CORPORATE", client: clients[3], guestCount: 30 });
  await seedBooking({ spaceKey: "ballroom", dayOffset: 38, startTime: "10:00", endTime: "16:00", slotType: "HOURLY", status: "INQUIRY", eventType: "CHURCH_PROGRAM", client: clients[11], guestCount: 300, notes: "Annual fundraising gala — asked about AV and stage." });
  await seedBooking({ spaceKey: "pavilion", dayOffset: 27, startTime: "14:00", endTime: "19:00", slotType: "HOURLY", status: "INQUIRY", eventType: "BIRTHDAY", client: clients[14], guestCount: 70 });
  await seedBooking({ spaceKey: "pavilion", dayOffset: 41, startTime: "11:00", endTime: "16:00", slotType: "HALF_DAY", status: "CANCELLED", client: clients[8], guestCount: 80, paid: "DEPOSIT" });

  // December peak showcase (if in the future): a peak-priced wedding.
  const decDate = new Date(`${decemberYear}-12-19T00:00:00Z`);
  const daysToDec = Math.floor((decDate.getTime() - Date.now()) / 86_400_000);
  if (daysToDec > 0 && daysToDec < 200) {
    await seedBooking({ spaceKey: "ballroom", dayOffset: daysToDec, startTime: "17:00", endTime: "23:00", slotType: "EVENING", status: "CONFIRMED", eventType: "WEDDING", client: clients[4], guestCount: 260, withAddOns: true, paid: "DEPOSIT", notes: "December peak pricing (+40%) applied." });
  }

  // Tour requests -------------------------------------------------------------
  await db.tourRequest.create({
    data: { venueId: venue.id, spaceId: ballroom.id, name: "Deborah Eze", email: "deborah.eze@example.com", phone: "+1 (555) 344-8821", requestedAt: venueLocalToUtc(TZ, localDateStr(3), "15:00"), status: "PENDING", notes: "Wedding next spring, ~250 guests." },
  });
  await db.tourRequest.create({
    data: { venueId: venue.id, spaceId: pavilion.id, name: "Marcus Hill", email: "marcus.hill@example.com", requestedAt: venueLocalToUtc(TZ, localDateStr(4), "11:00"), status: "PENDING" },
  });
  await db.tourRequest.create({
    data: { venueId: venue.id, name: "Priya Nair", email: "priya.nair@example.com", requestedAt: venueLocalToUtc(TZ, localDateStr(2), "10:30"), status: "CONFIRMED", notes: "Corporate year-end party." },
  });

  console.log(`✅ Seeded: ${created} bookings (${skipped} slot collisions skipped)`);
  console.log(`   Venue: http://localhost:3000/v/regency-event-center`);
  console.log(`   Owner: owner@regency.demo / demo1234`);
  console.log(`   Admin: admin@venuora.demo / demo1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
