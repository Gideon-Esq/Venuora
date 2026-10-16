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
# 1. Configure .env with your Supabase PostgreSQL connection (see below)
# 2. Install and apply the existing migrations
npm install
npm run db:deploy

# 3. Run
npm run dev
```

### Supabase database

The app uses Supabase PostgreSQL through the existing Prisma client. In the
Supabase dashboard, open **Connect**, select **Session pooler**, and copy the
PostgreSQL URI into `DATABASE_URL` in the root `.env`. Replace the password
placeholder with your database password (URL-encode special characters).

```dotenv
DATABASE_URL="postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres"
# Optional: direct or session-pooler URI for migrations when runtime uses a transaction pooler.
DIRECT_URL="postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY"
```

Copy the actual host and username from your project's Connect panel. The public
Supabase URL and publishable key are API credentials; they do not replace the
PostgreSQL connection string. Runtime queries use `DATABASE_URL`; Prisma CLI
uses `DIRECT_URL` when supplied, otherwise `DATABASE_URL`. Keep database
credentials server-only. Auth.js continues to handle login.

`npm run db:deploy` applies the committed migrations, including the database
constraint that prevents overlapping bookings. Use migrations rather than
`prisma db push` to preserve that constraint. Restart the dev server after
changing `.env`.

For an empty development database only, `npm run db:seed` creates the demo
accounts and venue below. **The seed deletes existing application data.**
Skip it for a database containing real data. Switching connection strings does
not transfer records from the former local database.

After seeding an empty development database, open:

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

## Image uploads

Venue logos, venue photos and space photos support file uploads to Vercel Blob.
Create and connect a public Blob store, set the server-only `BLOB_READ_WRITE_TOKEN`,
then restart locally or redeploy. See [the setup and verification guide](docs/vercel-blob-setup.md).

## Email delivery

Booking emails and sign-in links use the Gmail API with server-only OAuth settings:
`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and `EMAIL_FROM`.
Follow [Gmail API setup](docs/gmail-api-setup.md). With no Gmail credentials,
existing Resend / local console delivery remains available. SMTP is not used.
