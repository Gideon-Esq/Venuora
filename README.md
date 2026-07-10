# Venuora

Booking & management platform for independent event halls, banquet centers,
community halls and small venues. One promise above all: **zero
double-bookings** — enforced by the database itself, not by application code.

## Stack

Next.js (App Router, TypeScript strict) · PostgreSQL + Prisma · Stripe Connect
(Standard) + Stripe Billing · Auth.js (magic link + password) · Resend ·
Tailwind CSS · Vitest. Single app, deployed on Vercel.

## Quick start

```bash
# 1. Postgres (local dev)
docker run -d --name venuora-pg -e POSTGRES_PASSWORD=venuora \
  -e POSTGRES_DB=venuora -p 5432:5432 postgres:16

# 2. Install, migrate, seed the demo venue
npm install
cp .env.example .env   # fill in secrets, or keep placeholders for dev mode
npx prisma migrate dev
npm run db:seed

# 3. Run
npm run dev
```

Then open:

- **Public demo page:** http://localhost:3000/v/regency-event-center
- **Owner dashboard:** http://localhost:3000/login — `owner@regency.demo` / `demo1234`
- **Super-admin:** http://localhost:3000/admin — `admin@venuora.demo` / `demo1234`

**Dev mode:** with placeholder Stripe/Resend keys, payments are simulated (a
"simulate payment" redirect that exercises the same code path as the real
webhook) and magic links / emails are printed to the server console. Drop in
real keys and the same flows go live.

## Tests

```bash
npm test
```

Unit tests cover the pure pricing engine (day-of-week multipliers, peak-date
overrides, packages + overtime, add-ons, tax, tiered cancellation refunds,
security-deposit settlements). Integration tests run against real Postgres and
prove the booking engine's core guarantees: buffer overlaps rejected at the DB
level, penciled-hold expiry racing an online booking, N concurrent bookings of
the same Saturday evening producing exactly one winner, and midnight-crossing
events.

## How double-booking prevention works

- A booking blocks `[start − setup_buffer, end + teardown_buffer)` — half-open.
- A PostgreSQL **exclusion constraint** (GiST, `btree_gist`) on
  `(space_id, tsrange(blockedStart, blockedEnd))` rejects any overlapping write
  for blocking statuses (`HOLD`, `PENCILED`, `CONFIRMED`, `COMPLETED`,
  `NO_SHOW`). See `prisma/migrations/*_booking_exclusion_constraint/`.
- `INQUIRY` and `QUOTE_SENT` never block. `PENCILED` (owner soft hold) and
  `HOLD` (15-minute online checkout hold) block until `holdExpiresAt`; expired
  holds are swept to `EXPIRED` inside every booking transaction.
- Booking writes run in serializable transactions with retry; on conflict the
  API returns alternative spaces and dates instead of an error page.
- Availability is always **computed from bookings** — there is no separate
  calendar to drift out of sync.

## Money flows (Stripe Connect, Standard accounts)

Deposit at confirmation → balance N days before the event (payment link or
auto-charge) → refundable security deposit collected with the balance →
post-event settlement with itemized deductions → tiered cancellation refunds.
The platform takes a 3% application fee on online payments
(`PLATFORM_FEE_BPS`), plus SaaS subscriptions ($49/$99/$199, 30-day trial) via
Stripe Billing. All payment state is webhook-driven and idempotent
(`WebhookEvent` ledger).

## Layout

```
prisma/            schema, migrations (incl. exclusion constraint), seed
src/lib/           pricing.ts (pure engine) · booking.ts (engine) · time.ts ·
                   money.ts · payments.ts · quotes.ts · stripe.ts · tenancy.ts ·
                   email-templates.ts · validators.ts (zod at every boundary)
src/actions/       server actions (auth, venue, space, booking, public, tours)
src/app/app/       owner dashboard (calendar, bookings, wizard, settings)
src/app/v/[slug]   public venue page + booking flow
src/app/b/[token]  client manage-booking (no account needed)
src/app/q/[token]  quote accept & pay
src/app/admin/     super-admin
tests/             vitest unit + Postgres integration tests
```

## Cron

`/api/cron/daily` (Vercel Cron, `vercel.json`): balance reminders (14 & 3 days
before due), event-week logistics emails, hold-expiry sweep, auto-completing
past events (thank-you + security-refund notices). Set `CRON_SECRET` in prod.
