<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Known Next 16 changes: `params`/`searchParams` are Promises (await them); `cookies()`/`headers()` are async; `middleware.ts` is now `proxy.ts`; Turbopack is the default bundler.

# Venuora conventions (READ BEFORE WRITING UI)

Multi-tenant venue-booking SaaS. Buyer = non-technical venue owner; every screen must be obvious, mobile-responsive, warm and trustworthy. Brand accent: indigo-600.

## Stack & rules
- Next.js App Router + TS strict, Tailwind v4 (no config file — theme via `@theme` in `src/app/globals.css`). React Server Components by default; `"use client"` only where interactivity demands it.
- **No new dependencies.** Available: lucide-react, date-fns, @date-fns/tz, react-day-picker v10, clsx/tailwind-merge/cva, zod.
- Import alias `@/*` → `src/*`. Prisma client: `@/generated/prisma/client`, enums from `@/generated/prisma/enums`.
- Money is integer cents → format ONLY with `formatMoney(cents, currency)` from `@/lib/money`. Times are UTC instants → render ONLY via helpers in `@/lib/time` (`formatInVenueTz`, `venueDateStr`, …) with the venue's `timezone`. Never bare `toLocaleString()` without tz.
- Server data access: `db` from `@/lib/db`. Owner pages MUST call `requireVenue(slug, minRole)` from `@/lib/tenancy` (returns `{venue, role}`) and scope every query by `venueId`. Public pages: only `published: true` venues, free/busy only — never leak client names of other bookings.
- Mutations: use the existing server actions in `src/actions/*` (auth, venue, space, booking, public, tours, quote). Read their signatures before building forms. Do not write new raw mutations in pages.
- UI kit in `src/components/ui/`: Button, Input, Textarea, Select, Label, Card(+Header/Title/Description/Content/Footer), Badge, StatusBadge, Dialog. Labels/colors for statuses & event types: `@/lib/labels`.
- Availability/calendar data: `busyIntervals`, `checkSlot` from `@/lib/booking`. Booking status flow: INQUIRY → QUOTE_SENT → PENCILED → CONFIRMED → COMPLETED (+ HOLD for online checkout, CANCELLED/NO_SHOW/EXPIRED).
- Buffers: `blockedStart/blockedEnd` on Booking already include setup/teardown; render buffer extensions as hatched/translucent.
- Keep components local to your route folder unless told otherwise. Do not edit files outside your assigned area.
- Verify with `npx tsc --noEmit` before finishing.
