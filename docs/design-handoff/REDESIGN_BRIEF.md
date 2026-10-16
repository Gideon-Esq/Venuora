# Venuora
## Complete UI/UX Redesign Brief

> **Audience:** a senior UI/UX designer who has never seen Venuora and has never spoken to the developer.
> **Prepared from:** a full read of the repository at commit `95d177e` (every route, layout, component, server action, library and the Prisma schema), plus a live run of the app against a seeded database, with **131 screenshots** captured by a headless browser (see §22).
> **Date:** 1 October 2026.
>
> **How to read this document.** Sections 1–9 explain the product and its structure. Section 10 is the screen-by-screen specification, the core of the handoff. Sections 11–21 are cross-cutting inventories and audits. Sections 22–26 are the reference package and the checklists. Every claim about behaviour comes from the source code. File references are given as `path:line` so an engineer can verify them.
>
> **Labels used throughout:**
> - 🐞 **Defect.** The current build does something wrong, such as a broken link or a 404 a user can reach. Don't copy it into the redesign. Flag it for engineering.
> - ⚠️ **UX problem.** It works as built, but it is confusing, risky or inconsistent.
> - 🔒 **Rule.** A business or product rule the redesign must not break.
> - ❓ **Open question.** Something the code cannot answer (collected in §25).

---

### Table of contents

1. Executive Product Summary
2. Product Purpose
3. Technology Overview
4. User Roles
5. Role × Permission Matrix
6. Complete Route Inventory
7. Information Architecture
8. Navigation Architecture
9. Core User Journeys
10. Screen-by-Screen Specification
11. Forms Inventory
12. Components Inventory
13. UI State Inventory
14. Responsive Behaviour
15. Existing Visual Language
16. Asset Inventory
17. Accessibility Findings
18. Content & Microcopy Findings
19. UX Problems
20. Business Rules
21. Technical Constraints
22. Screenshot Index
23. Screen Priority Matrix
24. Future Design-System Requirements
25. Questions / Unknowns
26. Designer Checklist
27. Coverage Verification

---

## 1. Executive Product Summary

**Venuora** is a multi-tenant booking and management SaaS for **independent event venues**: banquet halls, community halls, church auditoriums, small event centres and meeting rooms. Each paying customer is a **venue**, which owns one or more bookable **spaces** (for example "The Grand Ballroom", "Garden Pavilion" or "The Boardroom").

The product has **four distinct surfaces**. They currently share almost no visual language beyond the colour indigo-600.

| Surface | Who uses it | Routes | Branding |
|---|---|---|---|
| **A. Marketing & auth** | Prospective venue owners | `/`, `/login`, `/login/check-email`, `/register` | Venuora brand |
| **B. Owner app ("dashboard")** | Venue owners, managers and staff (signed in) | `/app/**` | Venuora brand. The venue's colour appears only as a dot |
| **C. Client-facing venue pages** | The venue's customers (no account) | `/v/[slug]`, `/v/[slug]/book`, `/v/[slug]/tour`, `/b/[token]`, `/q/[token]` | **The venue's brand** (brand colour, logo, name), plus a small "Powered by Venuora" |
| **D. Platform super-admin** | Venuora staff | `/admin` | Bare. Almost no styling |

There is also a fifth, off-app surface: **transactional emails**. There are 11 venue-branded templates plus the sign-in magic link. Clients see these, so they are part of the experience (§10.33).

**The product's core promise is "zero double-bookings".** The database enforces it. The UI must always communicate availability, holds and conflicts honestly (§20).

**Current state of the UI.** The app is functional and reasonably complete, but it was built screen by screen without a design system. Typography, spacing, headers and feedback patterns vary between pages. There are no loading, error or 404 screens of its own. Several role-permission mismatches send Staff and Managers to blank 404 pages from links they can see. One primary navigation item (Add-ons) is a broken link. These are listed in §19.

---

## 2. Product Purpose

### 2.1 The problem it solves
Small venues run on paper diaries, WhatsApp threads and memory. That leads to double-booked Saturdays, unpaid balances, awkward refund conversations, and lost bookings because nobody answered the phone with a price.

### 2.2 What Venuora does (as built)
1. **One calendar per space.** It is computed from bookings and protected by a database exclusion constraint. A booking blocks its event time **plus setup and teardown buffers**.
2. **Fast phone booking.** A one-screen dialog meant to be filled in "in under 45 seconds" while a caller is on the line. It has four exits: *Log inquiry*, *Send quote*, *Pencil hold*, or *Confirm + deposit link*.
3. **Automatic pricing.** Hourly rates with a minimum, half-day, full-day and evening packages, overtime, day-of-week multipliers, peak periods, add-ons and tax. Prices are snapshotted on the booking and never recomputed.
4. **Money flow through Stripe Connect.** The deposit confirms the booking. Then the balance is collected, along with a refundable security deposit. After the event, the security deposit is settled with itemised deductions. Cancellations are refunded according to the venue's tiered policy. The platform takes a 3% fee on online payments.
5. **A public venue page.** Photos, spaces, "from" prices, a free/busy month calendar, policies, a 5-step online booking wizard and a tour-request form.
6. **Quotes.** A branded quote page with an "Accept & pay deposit" button.
7. **Manage-my-booking page for clients.** Clients reach it by a private link and need no account. They can pay the balance or cancel there, with a refund preview.
8. **Automated emails.** Inquiry acknowledgement, quote, deposit receipt, balance reminders (14 and 3 days before due), event-week logistics (5 days before), thank-you, security refund, cancellation, tour confirmed, and a tour request sent to the owner.
9. **Teams.** Owner, Manager and Staff roles. One user can belong to several venues.
10. **SaaS subscription.** Solo $49 (1 space), Growth $99 (5 spaces), Pro $199 (10 spaces), each with a 30-day trial.
11. **Super-admin.** Platform stats, a venue list and audit-logged impersonation.

### 2.3 Primary buyer
A **non-technical venue owner** (AGENTS.md: "every screen must be obvious, mobile-responsive, warm and trustworthy"). They will often be on a phone, often mid-call, and often older or less digitally fluent than a typical SaaS user. Copy throughout the app is deliberately plain-language (`src/lib/labels.ts:1-2`).

### 2.4 Demo data (useful for design)
`prisma/seed.ts` creates "The Regency Event Center" (Atlanta, America/New_York, Growth plan, Stripe connected, published). It has 3 spaces, 10 add-ons, about 20 clients, about 65 bookings in every status, and 3 tour requests. Logins: `owner@regency.demo`, `manager@regency.demo` and `admin@venuora.demo`, all with password `demo1234`. For the screenshots I also added a Staff user and an empty second venue ("Riverside Community Hall") to a throwaway database. The repository was not changed.

---

## 3. Technology Overview

| Concern | What is used | Designer implication |
|---|---|---|
| Framework | **Next.js 16.2 App Router**, React 19.2, TypeScript strict. React Server Components by default | Most pages render on the server. Interactive parts are client components. Navigation between pages is full route transitions; there are no SPA-style local views except dialogs and the booking wizard |
| Styling | **Tailwind CSS v4** with no config file. The theme lives in `@theme` in `src/app/globals.css`, which defines only `background`, `foreground` and the font variables | Any token system you design maps directly to Tailwind `@theme` variables |
| Components | Hand-rolled kit in `src/components/ui/`: Button, Input, Textarea, Select, Label, Card(+5 parts), Badge, StatusBadge, Dialog. Built with `class-variance-authority`, `clsx` and `tailwind-merge` (the shadcn idiom, without Radix) | You can define the system from scratch. Nothing third-party constrains the look |
| Icons | **lucide-react** only | Keep to Lucide or supply an equivalent set |
| Fonts | **Geist Sans** and **Geist Mono** via `next/font/google` (`src/app/layout.tsx`) | Can be swapped freely |
| Dates | date-fns, @date-fns/tz, react-day-picker v10. **Installed but not used**: every date input is a native `<input type="date">` | A styled date picker is possible with no new dependency |
| Charts | **None** | Any dashboard chart is new UI. The data exists in the DB, but queries would need adding |
| Forms | No form library. Controlled React state plus server actions, validated by **zod** on the server (`src/lib/validators.ts`) | Errors come back as **one message per submit**, not per field (see §11) |
| Animation | Only `transition-colors`, `transition-shadow`, `animate-spin` (spinners) and a few hover transforms. `tailwindcss-animate` is installed but unused | No motion system exists |
| Auth | **Auth.js v5 (next-auth beta)**: magic link by email (Resend) **plus** email and password. JWT sessions | There is **no password reset** and no account or profile page (§25) |
| Data | PostgreSQL + Prisma 7 | — |
| Payments | **Stripe Connect Standard** (hosted Checkout) and **Stripe Billing** (hosted subscription Checkout). In dev, a "simulate payment" redirect stands in | Payment pages are **Stripe-hosted**. You design the hand-off into and out of Stripe, not the card form |
| Email | Resend. HTML templates are hand-written in `src/lib/email-templates.ts` | Email design is in scope |
| Jobs | Daily cron `/api/cron/daily` at 08:00 UTC: reminders, logistics emails, hold sweep, auto-complete | Status can change overnight without any user action |
| Hosting | Vercel | — |
| Constraint from AGENTS.md | **No new dependencies.** Money is shown only through `formatMoney`. Times are shown only in the venue's timezone | See §21 |

---

## 4. User Roles

The system supports exactly these roles: `VenueRole` = OWNER | MANAGER | STAFF in `prisma/schema.prisma`, `User.isSuperAdmin`, and anonymous token holders. No other roles exist. Do not design for "customer accounts", "moderators" or "vendors".

### 4.1 Visitor (anonymous, prospective venue owner)
- **Goal:** understand Venuora, decide to try it, sign up or sign in.
- **Can access:** `/`, `/login`, `/login/check-email`, `/register`, and any published venue page (as an example).
- **Cannot access:** anything under `/app` or `/admin` (redirected to `/login`).
- **Primary workflow:** Landing → Start free trial → Register → (auto sign-in) → Create venue.
- **Secondary:** "See a live venue page" (hard-coded link to the demo venue), Pricing anchor, Sign in.
- **Highest-risk action:** none.

### 4.2 Client (the venue's customer; no account)
Venuora's end-customers **never create accounts**. They are identified by the **unguessable link tokens** in their emails.
- **Goal:** find out whether the venue is free on their date, what it costs, book or request it, pay, and later manage or cancel.
- **Can access:** published `/v/[slug]` pages; `/v/[slug]/book`; `/v/[slug]/tour`; `/b/[manageToken]` (their booking); `/q/[quoteToken]` (their quote); Stripe-hosted Checkout.
- **Cannot access:** other clients' details. The public availability shows **free/busy only**, with no names (🔒). Clients also cannot reach unpublished venue pages.
- **Primary workflows:** (a) instant booking with deposit; (b) request-to-book; (c) accept a quote and pay the deposit; (d) pay the balance; (e) cancel with a refund preview; (f) request a tour.
- **Most frequent actions:** browsing the venue page, checking availability, reviewing the price.
- **Highest-risk actions:** **paying**; **cancelling**, which is irreversible and loses money under the policy.
- **Must see quickly:** date and time in the venue's timezone, total price, deposit due now, balance and due date, the refundable security deposit, the cancellation policy, and the status of their booking.

### 4.3 Venue Owner (`OWNER`)
- **Goal:** run the venue's bookings and money with no double-bookings and no chasing.
- **Can access:** everything under `/app/[venueSlug]/**`, including **Settings** (all six tabs) and **Onboarding**, which are owner-only.
- **Primary workflows:** check This week; take phone bookings from the calendar; turn inquiries into quotes or confirmations; collect payments; cancel; settle security deposits.
- **Secondary:** set up spaces, rates, add-ons, policies and branding; connect Stripe; choose a plan; invite the team; publish the venue page.
- **Dashboard needs:** today and the next 7 days of events, what's unpaid, new inquiries, pending tours, and month totals.
- **Highest-risk actions:** cancelling a booking (triggers refunds and an email); recording a manual deposit (confirms the booking); settling a security deposit (irreversible refund); deactivating a space (no way to undo it in the UI); changing policies or timezone; inviting someone as Owner; changing plan.

### 4.4 Venue Manager (`MANAGER`)
- **Goal:** run the day-to-day for the owner.
- **Can access:** Dashboard (with payment-link and tour actions), Calendar (can create and move bookings), Bookings list and detail with all actions, Clients list and detail (can edit), Tours, Spaces, Add-ons.
- **Cannot access:** **Settings** (all tabs → 404), **Onboarding** (→ 404). ⚠️ Both are still shown to them: the Settings item in the sidebar and the "Setup incomplete" banner.
- **Note:** the server actions behind *venue details* and *branding* allow MANAGER, but the pages that host them require OWNER (`src/actions/venue.ts:53,111` vs `settings/layout.tsx:12`). ❓ Decide whether Managers should see those two tabs.

### 4.5 Venue Staff (`STAFF`)
- **Goal:** know what's happening and tick off setup and teardown on the day.
- **Can access:** Dashboard (read-only, except the Setup/Teardown toggles), Calendar (read-only: no "New booking", no click-to-book, no drag, read-only dialog), Bookings **list**, Clients **list**.
- **Cannot access, but sees links to:** Booking detail (every booking row and calendar "Open booking" link → 404), Client detail (→ 404), Tours (→ 404), Spaces (→ 404), Add-ons (→ 404), Settings (→ 404), Onboarding (→ 404). 🐞 This is the largest role-UX problem in the product (§19).
- **Most frequent action:** Setup ✓ and Teardown ✓ toggles on the dashboard.

### 4.6 Super-admin (`User.isSuperAdmin`)
- **Goal:** platform oversight and support.
- **Can access:** `/admin`, plus **any** venue's `/app/[slug]/**` with full Owner powers ("impersonation"). Every request is audit-logged and an amber banner is shown.
- **Cannot:** no dedicated admin actions exist (no suspend, no plan override, no user management).
- **⚠️** There is no link from the app to `/admin`; it must be typed. A super-admin with no venue memberships who visits `/app` is redirected to "Create your venue".
- **Highest-risk action:** acting inside a customer's venue while impersonating. Everything they do is real.

### 4.7 Transitional state: signed-in user with no venue
Not a role. After registering, or for an invited member who was removed (removal doesn't exist yet), `/app` redirects to `/app/new`. An invited team member who signs in will have a membership, so they skip this.

---

## 5. Role × Permission Matrix

Legend: ✅ allowed · 👁 visible read-only · 🚫 hidden or not offered · **404** = link or route is visible or reachable but returns the framework 404 · — = not applicable.

### 5.1 Role → page

| Page | Visitor | Client (token) | Staff | Manager | Owner | Super-admin |
|---|---|---|---|---|---|---|
| `/` Landing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/login`, `/register`, `/login/check-email` | ✅ | ✅ | ✅ (no redirect when signed in) | ✅ | ✅ | ✅ |
| `/app` (picker/redirect) | → /login | → /login | ✅ | ✅ | ✅ | ✅ (→ /app/new if no memberships) |
| `/app/new` | → /login | → /login | ✅ | ✅ | ✅ | ✅ |
| `/app/[v]` This week | → /login | — | ✅ 👁 | ✅ | ✅ | ✅ (impersonating) |
| `/app/[v]/onboarding` | — | — | **404** (banner links here) | **404** (banner links here) | ✅ | ✅ |
| `/app/[v]/calendar` | — | — | 👁 | ✅ | ✅ | ✅ |
| `/app/[v]/bookings` | — | — | 👁 | ✅ | ✅ | ✅ |
| `/app/[v]/bookings/[id]` | — | — | **404** (linked from list/calendar/dashboard) | ✅ | ✅ | ✅ |
| `/app/[v]/clients` | — | — | 👁 | ✅ | ✅ | ✅ |
| `/app/[v]/clients/[id]` | — | — | **404** (linked from list) | ✅ | ✅ | ✅ |
| `/app/[v]/tours` | — | — | **404** (in sidebar) | ✅ | ✅ | ✅ |
| `/app/[v]/spaces`, `/new`, `/[id]` | — | — | **404** (in sidebar) | ✅ | ✅ | ✅ |
| `/app/[v]/addons` | — | — | **404** | ✅ | ✅ | ✅ |
| `/app/[v]/add-ons` (sidebar link) | — | — | **404** 🐞 | **404** 🐞 | **404** 🐞 | **404** 🐞 |
| `/app/[v]/settings/*` | — | — | **404** (in sidebar) | **404** (in sidebar) | ✅ | ✅ |
| `/admin` | → /login | — | 404 | 404 | 404 | ✅ |
| `/v/[slug]` (+/book, /tour) | ✅ if published | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/b/[token]` | anyone with link | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/q/[token]` | anyone with link | ✅ | ✅ | ✅ | ✅ | ✅ |

### 5.2 Role → action

| Action | Staff | Manager | Owner | Client | Notes |
|---|---|---|---|---|---|
| Toggle Setup / Teardown checklist | ✅ | ✅ | ✅ | — | Dashboard only |
| Create phone booking (4 exits) | 🚫 | ✅ | ✅ | — | Calendar |
| Move / reschedule booking (with reprice) | 🚫 | ✅ | ✅ | — | Calendar dialog or drag |
| Send quote | 🚫 | ✅ | ✅ | — | Booking detail, phone form |
| Pencil hold (1–30 days) | 🚫 | ✅ | ✅ | — | |
| Confirm + deposit link | 🚫 | ✅ | ✅ | — | |
| Send balance payment link | 🚫 | ✅ | ✅ | — | Detail page and dashboard |
| Record manual payment | 🚫 | ✅ | ✅ | — | |
| Cancel booking (with policy refund) | 🚫 | ✅ | ✅ | ✅ (own, before start) | |
| Mark no-show | 🚫 | ✅ | ✅ | — | Only CONFIRMED and past |
| Settle security deposit | 🚫 | ✅ | ✅ | — | |
| Edit client record | 🚫 | ✅ | ✅ | — | |
| Confirm / decline / complete / cancel tour | 🚫 | ✅ | ✅ | — | |
| Create / edit space, rates; deactivate space | 🚫 | ✅ | ✅ | — | Plan limit applies on create |
| Create / edit / remove add-on | 🚫 | ✅ | ✅ | — | |
| Venue details, branding | 🚫 | (action allows; page 404) | ✅ | — | ❓ |
| Policies, payments (Stripe), billing, team | 🚫 | 🚫 | ✅ | — | |
| Publish venue | 🚫 | 🚫 | ✅ | — | No unpublish exists |
| Book online / request / pay deposit / pay balance | — | — | — | ✅ | |
| Accept quote | — | — | — | ✅ | |
| Request tour | — | — | — | ✅ | |
| View platform stats, impersonate | — | — | — | — | Super-admin only |

---

## 6. Complete Route Inventory

### 6.1 Master list

Notation: `[v]` = `[venueSlug]`. "Guard" = server-side check. **Route files**: `src/app/**/page.tsx`.

| # | Route | Page name (current H1) | Access / guard | Public? | Main purpose | Reached from |
|---|---|---|---|---|---|---|
| R1 | `/` | "Never double-book your hall again" | none | Public | Marketing | Direct, footer "Powered by Venuora", sign-out redirect |
| R2 | `/login` | Sign in (two cards) | none | Public | Magic-link and password sign-in | Header, register page, auth redirects |
| R3 | `/login/check-email` | "Check your inbox" | none | Public | Confirmation after magic-link request | Magic-link submit |
| R4 | `/register` | "Create your account" | none | Public | Sign up | Landing CTAs, login page |
| R5 | `/app` | "Your venues" | signed in | Private | Picker if ≥2 venues; **redirects** if 0 (→/app/new) or 1 (→/app/[v]) | After login/register; admin "Back to app" |
| R6 | `/app/new` | "Create your venue" | signed in | Private | Create a venue | R5 redirect, "New venue" button |
| R7 | `/app/[v]` | "This week" | member (any role) | Private | Operational dashboard | Sidebar "This week", venue picker |
| R8 | `/app/[v]/onboarding` | "Set up your venue" | OWNER | Private | 7-step setup checklist | Redirect after create venue; "Setup incomplete" banner |
| R9 | `/app/[v]/calendar` `?view=month\|week\|day&date=YYYY-MM-DD` | "Calendar" | member | Private | Calendar, phone booking, reschedule | Sidebar, dashboard empty state |
| R10 | `/app/[v]/bookings` `?status=all\|inquiries\|quotes\|penciled\|confirmed\|past\|cancelled&q=` | "Bookings" | member | Private | List, filter, search | Sidebar, booking detail back link |
| R11 | `/app/[v]/bookings/[id]` | "{Client} — {Space}" | MANAGER+ | Private | Booking record and all lifecycle actions | Bookings list, dashboard, calendar dialog, client detail |
| R12 | `/app/[v]/clients` `?q=` | "Clients" | member | Private | Client list and search | Sidebar |
| R13 | `/app/[v]/clients/[id]` | "{Client name}" | MANAGER+ | Private | Edit contact, booking history | Clients list, booking detail |
| R14 | `/app/[v]/tours` | "Tour requests" | MANAGER+ | Private | Manage viewings | Sidebar, owner email link |
| R15 | `/app/[v]/spaces` | "Spaces" | MANAGER+ | Private | List spaces | Sidebar, onboarding |
| R16 | `/app/[v]/spaces/new` | "Add a space" | MANAGER+ | Private | Create space | Spaces list, onboarding |
| R17 | `/app/[v]/spaces/[id]` | "{Space name}" | MANAGER+ | Private | Edit space, rates, deactivate | Spaces list; redirect after create |
| R18 | `/app/[v]/addons` | "Add-ons" | MANAGER+ | Private | Add-on catalogue | **Only** onboarding step 4 (sidebar link is broken 🐞) |
| R19 | `/app/[v]/settings` | Settings › General | OWNER | Private | Venue details | Sidebar |
| R20 | `/app/[v]/settings/policies` | Settings › Policies | OWNER | Private | Deposit, balance, security, tax, house rules, cancellation tiers | Settings tabs, onboarding |
| R21 | `/app/[v]/settings/branding` | Settings › Branding | OWNER | Private | Brand colour, logo URL, venue photos | Settings tabs |
| R22 | `/app/[v]/settings/payments` `?dev_onboarded=1\|connected=1\|refresh=1` | Settings › Payments | OWNER | Private | Stripe Connect status | Settings tabs; Stripe return URLs |
| R23 | `/app/[v]/settings/billing` `?dev_subscribed=TIER\|subscribed=1` | Settings › Billing | OWNER | Private | Plan selection | Settings tabs; Stripe return; plan-limit error copy |
| R24 | `/app/[v]/settings/team` | Settings › Team | OWNER | Private | Members, invite | Settings tabs |
| R25 | `/admin` | "Venuora admin" | super-admin (else 404) | Private | Platform overview, impersonation | Typed URL only |
| R26 | `/v/[slug]` `?month=YYYY-MM` | {Venue name} | published venues only (else 404) | Public | Venue marketing, availability, policies | Shared link, onboarding, sidebar "View public page", Back links |
| R27 | `/v/[slug]/book` `?space=&date=` | "Book {Venue}" | published | Public | 5-step booking wizard | Venue page CTAs, availability day cells |
| R28 | `/v/[slug]/tour` | "Book a 30-minute viewing" | published | Public | Tour request | Venue page, wizard empty state |
| R29 | `/b/[token]` `?paid=1\|confirmed=1\|pay=balance` | "{Event type} at {Venue}" | token | Public (unlisted) | Client's booking: status, money, pay balance, cancel | Emails, wizard success, quote page, owner copy-link, Stripe return |
| R30 | `/q/[token]` | "Quote #N" | token | Public (unlisted) | Review and accept the quote, pay deposit | Quote email |

**Non-page routes that affect UX:**

| # | Route | Purpose | UX relevance |
|---|---|---|---|
| A1 | `/api/auth/[...nextauth]` | Auth.js: magic-link callback, sign-out, session | ⚠️ An expired or used magic link lands on **Auth.js's built-in unstyled error page** (no `pages.error` is configured, `src/lib/auth.ts:15`). It needs a design |
| A2 | `/api/dev/simulate-payment` | Dev-only stand-in for Stripe Checkout | Instant redirect. In production this is Stripe's hosted page |
| A3 | `/api/webhooks/stripe` | Payment state | Causes status changes the user sees later |
| A4 | `/api/cron/daily` | Reminders, holds, auto-complete | Statuses change overnight |
| — | **Framework 404** | No `not-found.tsx` anywhere | Every not-found case (bad slug, unpublished venue, bad token, insufficient role, cross-tenant id) shows the **default Next.js black/white 404**. Needs design |
| — | **Framework error** | No `error.tsx` or `global-error.tsx` | Any thrown server error shows the default Next.js error screen |
| — | **Loading** | No `loading.tsx` | Route transitions show nothing until the server responds (slow on calendar and bookings) |
| — | External | Stripe Checkout (deposit, balance, subscription), Stripe Connect onboarding, Google Maps "Get directions" | Hand-off points to design around |

### 6.2 Detailed route cards
Per-route detail (actions, information, forms, components, conditional sections, edge cases, concerns, mobile) lives in **§10 Screen-by-Screen**, where each route has its own section. The table above gives the purpose and access summary.

### 6.3 Route coverage checklist

| Route file | Considered | Screenshotted | Spec section |
|---|---|---|---|
| `src/app/page.tsx` | ✅ | ✅ | 10.1 |
| `src/app/login/page.tsx` | ✅ | ✅ (+error) | 10.2 |
| `src/app/login/check-email/page.tsx` | ✅ | ✅ | 10.3 |
| `src/app/register/page.tsx` | ✅ | ✅ (+error) | 10.4 |
| `src/app/app/page.tsx` | ✅ | ✅ | 10.5 |
| `src/app/app/new/page.tsx` | ✅ | ✅ (+dark) | 10.6 |
| `src/app/app/[venueSlug]/layout.tsx` (shell) | ✅ | ✅ | 10.7 |
| `src/app/app/[venueSlug]/page.tsx` | ✅ | ✅ (owner/manager/staff/empty/mobile) | 10.8 |
| `.../onboarding/page.tsx` | ✅ | ✅ (complete/empty/error) | 10.9 |
| `.../calendar/page.tsx` | ✅ | ✅ (month/week/day, dialogs, staff, mobile) | 10.10–10.12 |
| `.../bookings/page.tsx` | ✅ | ✅ | 10.13 |
| `.../bookings/[id]/page.tsx` | ✅ | ✅ (7 states, 4 dialogs) | 10.14 |
| `.../clients/page.tsx` | ✅ | ✅ | 10.15 |
| `.../clients/[id]/page.tsx` | ✅ | ✅ | 10.16 |
| `.../tours/page.tsx` | ✅ | ✅ | 10.17 |
| `.../spaces/page.tsx` | ✅ | ✅ | 10.18 |
| `.../spaces/new/page.tsx` | ✅ | ✅ | 10.19 |
| `.../spaces/[id]/page.tsx` | ✅ | ✅ (+dialog) | 10.20 |
| `.../addons/page.tsx` | ✅ | ✅ (+dialog, +broken link) | 10.21 |
| `.../settings/layout.tsx` | ✅ | ✅ | 10.22 |
| `.../settings/page.tsx` | ✅ | ✅ | 10.23 |
| `.../settings/policies/page.tsx` | ✅ | ✅ | 10.24 |
| `.../settings/branding/page.tsx` | ✅ | ✅ | 10.25 |
| `.../settings/payments/page.tsx` | ✅ | ✅ (connected / not connected) | 10.26 |
| `.../settings/billing/page.tsx` | ✅ | ✅ (paid / trial) | 10.27 |
| `.../settings/team/page.tsx` | ✅ | ✅ | 10.28 |
| `src/app/admin/page.tsx` | ✅ | ✅ (light/dark/mobile) | 10.29 |
| `src/app/v/[slug]/page.tsx` | ✅ | ✅ | 10.30 |
| `src/app/v/[slug]/book/page.tsx` | ✅ | ✅ (every step, errors, success) | 10.31 |
| `src/app/v/[slug]/tour/page.tsx` | ✅ | ✅ (+error, +success) | 10.32 |
| `src/app/b/[token]/page.tsx` | ✅ | ✅ (6 states, dialog) | 10.34 |
| `src/app/q/[token]/page.tsx` | ✅ | ✅ | 10.35 |
| Framework 404 / error / Auth.js error | ✅ | ✅ 404 (several causes) / ❌ error / ❌ Auth.js error | 10.36 |
| Emails (11 + magic link) | ✅ | ❌ (not rendered in a browser) | 10.33 |
| API routes (4) | ✅ | n/a | 6.1 |

**30 of 30 page routes considered.** The only file not reachable as UI is `src/app/favicon.ico`.

---

## 7. Information Architecture

### 7.1 Current hierarchy

```
Venuora
├── A. Marketing & Auth (Venuora-branded, light canvas)
│   ├── /                        Landing: hero · how it works · features · pricing · FAQ · CTA · footer
│   ├── /register                Create account → (auto sign-in) → /app
│   ├── /login                   Magic link card · "or" · password card
│   │   └── /login/check-email   Magic link sent
│   └── (Auth.js error page)     expired/used link: unstyled framework page
│
├── B. Owner App  /app
│   ├── /app                     Venue picker (only when ≥2 venues; else redirect)
│   ├── /app/new                 Create venue
│   └── /app/[venue]             ── App shell: sidebar (desktop) / top bar + slide-over (mobile)
│       │                           + banners: impersonation · "Setup incomplete"
│       ├── This week (dashboard)    stat tiles · upcoming events (+checklists, payment link) · tours · inquiries
│       ├── Onboarding               7 steps (owner only; no nav item; reached via banner)
│       ├── Calendar                 Month | Week | Day  · legend
│       │   ├── [dialog] New booking (fast phone form) → [state] deposit-link success
│       │   └── [dialog] Booking quick view + Move (preview → confirm)
│       ├── Bookings                 7 status pills · search · table/cards
│       │   └── Booking detail       event time · price · payments | client · actions · client link
│       │       └── [dialogs] Pencil hold · Manual payment · Cancel (+result) · Settle security (+result)
│       ├── Clients                  search · table/cards
│       │   └── Client detail        contact form | booking history
│       ├── Tours                    Pending · Upcoming · Past
│       ├── Spaces                   card grid
│       │   ├── New space            space form
│       │   └── Space detail         space form · rates form · danger zone [dialog: deactivate]
│       ├── Add-ons                  table · [dialog: create/edit (+native confirm remove)]
│       └── Settings (owner only)    tabs: General · Policies · Branding · Payments · Billing · Team
│
├── C. Client-facing (venue-branded)
│   ├── /v/[slug]                Venue page: header · hero gallery · CTAs · spaces · availability · reviews(placeholder) · location · policies
│   │   ├── /book                5-step wizard → success / redirect to Stripe / conflict
│   │   └── /tour                Tour request → success
│   ├── /q/[token]               Quote → Accept & pay → Stripe → /b
│   └── /b/[token]               My booking: status banners · details · price · history · actions · policy
│       └── [dialog] Cancel (+refund preview, +result)
│
├── D. Super-admin  /admin       stats · venues table (Impersonate →) · audit log
│
└── E. Off-app surfaces          Stripe Checkout / Connect / Billing (hosted) · 11 venue-branded emails · magic-link email · Google Maps
```

### 7.2 IA problems to investigate (do not redesign blindly)

| # | Problem | Where | Severity |
|---|---|---|---|
| IA-1 | **Onboarding has no nav entry.** It is only reachable through a banner. Once setup is complete (`onboardingStep = 99`, which happens only on **publish**) the banner disappears and the page is only reachable by URL. | Shell | Medium |
| IA-2 | **Settings is a top-level nav item but owner-only.** Managers and Staff see it and get a 404. | Sidebar | High |
| IA-3 | **The sidebar shows the same 8 items to every role**, but 4–7 of them 404 for Staff. | Sidebar | Critical |
| IA-4 | **"Calendar" vs "Bookings" vs "This week"** are three views of the same records with different filters. Pending inquiries appear on the dashboard (latest 6), in the Bookings "Inquiries" tab, and as dashed bars on the calendar. Penciled bookings show on the dashboard only if within 7 days. | Owner app | Medium |
| IA-5 | **Booking actions live in two places with different capabilities.** The calendar dialog can *move* a booking. The detail page can do everything *except* move. Neither can edit guest count, notes, add-ons, event type or client. | Calendar / detail | High |
| IA-6 | **Venue details are edited in two places.** Onboarding step 1 embeds the exact Settings › General form. | Onboarding / Settings | Low |
| IA-7 | **Spaces and Add-ons are separate nav items, while Branding (venue photos) is under Settings.** Venue photos live in Settings › Branding but space photos live in Spaces. "Public page" content is split across three places: Settings › General description, Settings › Branding photos and logo, Spaces. | Owner app | Medium |
| IA-8 | **Tours are not on the calendar**, although the Tours page says "Confirmed visits on the calendar". | Tours | Medium |
| IA-9 | **Billing is buried in Settings** although plan limits block space creation. The error message says "upgrade" with no link. | Spaces / Billing | Medium |
| IA-10 | **No route for the account itself**: no profile, no password change, no "my venues" link in the shell except a switcher that only appears with ≥2 venues. | Global | Medium |
| IA-11 | **The super-admin has no navigation** between `/admin` and venues (other than Impersonate links), and no way back except the browser. | Admin | Low |
| IA-12 | **Clients surface has a split identity.** The venue page header, the booking/tour header and the token-page header are three different implementations (`v/[slug]/page.tsx:109-135`, `book/page.tsx:79-93`, `components/public/branded-header.tsx`). | Client-facing | Medium |

---

## 8. Navigation Architecture

### 8.1 Marketing header and footer (`src/app/page.tsx:142-168, 407-426`)
- Header: wordmark "Venu**ora**" (indigo "ora") → `/`. Right side: **Pricing** (anchor, hidden below `sm`), **Sign in**, **Start free trial** (primary).
- Footer: tagline, Pricing · Sign in · Start free trial, © year.
- No mobile menu. The header simply drops "Pricing" on small screens.

### 8.2 Auth pages
A centred wordmark linking to `/`. Cross-links: login ↔ register. Check-email → "Back to sign in". No header or footer.

### 8.3 Owner app shell (`src/components/app-shell/sidebar.tsx`)
- **Desktop (≥ `lg`, 1024px):** fixed 256px left sidebar.
  - **Top:** venue colour dot + venue name (truncated). **Venue switcher** `<select>` appears **only if the user belongs to ≥2 venues**.
  - **Primary nav** (icon + label, active = indigo-50 background): This week (Home) · Calendar (CalendarDays) · Bookings (ClipboardList) · Clients (Users) · Tours (Footprints) · Spaces (Sofa) · Add-ons (Package) 🐞 *links to `/add-ons`; the route is `/addons`* · Settings (Settings).
  - **Bottom:** "View public page" (opens `/v/[slug]` in a new tab, ExternalLink icon). It shows the 404 if the venue is unpublished. Next is an amber "Not published yet" note when unpublished, then **Sign out** (form button).
- **Mobile/tablet (< 1024px):** a sticky top bar with a hamburger (Menu/X icon), venue dot and venue name. Hamburger → **slide-over** from the left (288px, max 85vw) with a backdrop and an X close button, containing the same content. There is no focus trap, the Escape key doesn't close it, and body scroll is not locked.
- **Contextual banners** above the page content:
  - Amber: "Viewing as super-admin — this access is audit-logged." (impersonation)
  - Indigo: "**Setup incomplete.** Finish onboarding to publish your venue and take bookings online. →" (shown while `onboardingStep < 99`, to **every role**)
- **No breadcrumbs.** Detail pages use a "← All bookings / All clients / All spaces" back link.
- **No global search, notifications or user menu.** The user's own name and email are never shown in the shell.

### 8.4 Settings secondary nav (`settings/settings-nav.tsx`)
Horizontal pill tabs: General · Policies · Branding · Payments · Billing · Team. On narrow screens the row scrolls sideways (`overflow-x-auto`). Active = exact path match.

### 8.5 In-page navigation
- **Bookings:** 7 status pills (links with `?status=`), plus a search form (`?q=`). No pagination; the list is hard-capped at 200 rows.
- **Clients:** search only; capped at 300 rows.
- **Calendar:** Month/Week/Day segmented control; Previous / Today / Next; title. All of it is URL-driven (`?view=&date=`), so browser Back works.
- **Venue page availability:** ‹ › month links (`?month=`), limited to the current month through +18 months.
- **Booking wizard:** a 5-dot stepper (labels hidden on mobile) plus Back links. This is **in-memory state only**: refreshing the page loses all progress, and browser Back leaves the wizard entirely.

### 8.6 Client-facing headers
- Venue page: brand-colour 6px bar, white header with logo (if any) and venue name (not a link), and a "Check availability" brand button (hidden on mobile).
- Book and Tour: brand bar, venue name, "← Back to venue".
- `/b` and `/q`: `BrandedHeader`: brand bar, logo or **initial-letter tile in brand colour**, and name, linked to `/v/[slug]` only if the venue is published.
- Footer everywhere in this surface: "Powered by **Venuora**" → `/` (the marketing site).

### 8.7 Admin
A header with "Venuora admin" and "← Back to app" (→ `/app`). No other navigation.

---

## 9. Core User Journeys

Each journey below shows the happy path, decision points and failure paths as built.

### J1. Owner sign-up → first venue → publish
1. `/` → **Start free trial** → `/register`.
2. Fill in Name, Email and Password (min 8) → **Start free trial**.
   - ✗ Email already has a password → inline alert "An account with this email already exists — sign in instead." (no link to sign in inside the alert).
   - ✗ Validation (zod) → the first issue only, e.g. "Too small: expected string to have >=8 characters" (⚠️ raw zod wording, §18).
   - Note: if the email exists **without** a password (an invited team member), registration silently sets the name and password on that account.
3. Auto sign-in → `/app` → (0 venues) → `/app/new`.
4. Venue name + Timezone (26 options) → **Create venue** → the slug is auto-generated from the name (deduplicated with -2, -3…). The 30-day trial starts. Redirect to `/app/[slug]/onboarding`.
5. **Onboarding (7 cards, all visible at once; nothing is enforced in order):**
   1. Venue details: an embedded form; saving marks it done.
   2. Add your first space → `/spaces/new` → save → redirect to the space detail page.
   3. Set your rates → "Go to spaces" → open a space → Rates form → Save. Done when **any** active space has rates.
   4. Add-ons (Optional) → `/addons`.
   5. Booking policies → `/settings/policies` → Save (done when saved at least once, even unchanged).
   6. Connect Stripe → Stripe-hosted onboarding → returns to `/settings/payments`. In dev it is marked connected immediately.
   7. **Publish my venue page** → ✗ "Add at least one space before publishing" | ✓ "Your venue page is live!" with the URL and a Copy button.
6. Decision points: Stripe and add-ons can be skipped. **Publish requires only ≥1 active space.** It does *not* require rates, policies or Stripe. ⚠️ A venue can therefore publish with a space that has no rates. That space won't appear in the booking wizard (only spaces with rates are listed) but **will** appear on the venue page as "Pricing on request" with a "Book this space" button.
7. Going back and forth between onboarding and the separate pages has no "return to onboarding" affordance.

### J2. Sign in
- **Password:** `/login` → email + password → `/app` → redirect as in R5. ✗ "Invalid email or password".
- **Magic link:** email → "Email me a sign-in link" → `/login/check-email` → click the email link → Auth.js callback → returns to the page the request came from (likely `/login` again, now signed in, because no `redirectTo` is passed in `src/actions/auth.ts:56`) ❓ Verify in staging. The intended result is clearly "land in `/app`"; design for that. ✗ An invalid email → "Enter a valid email". ✗ An expired or reused link → Auth.js's default error page (unstyled).
- **Already signed in?** `/login` and `/register` don't redirect away. A signed-in user can see them.
- **Sign out:** sidebar → `/` (landing).
- **Forgot password: does not exist.** Users who forget their password can only use the magic link, and nothing on the screen tells them so.

### J3. Fast phone booking (Owner/Manager) — the signature workflow
1. Calendar → **New booking** (defaults to today, or the anchor date, 18:00–22:00, first space) **or** click an empty slot. In Week/Day view this prefills space, date, start (snapped to 30 min) and a +2h end. In Month view it prefills the date and first space only.
2. Dialog fields: Client name*, Phone*, Email (optional), Space, Event type, Slot (Hourly / Half-day / Full-day / Evening package), Date, Start, End, Ends next day, Guest count (default 50), Notes, Pencil days (default 5).
3. **Four exits:**
   - **Log inquiry** → INQUIRY (doesn't block the calendar) → dialog closes. ⚠️ No success message; it just closes.
   - **Send quote** → QUOTE_SENT, quote #N created, email sent **only if an email was entered**. ⚠️ With no email, nothing is sent and no warning appears.
   - **Pencil hold (N days)** → PENCILED, blocks the slot until now + N days.
   - **Confirm + deposit link** → status **CONFIRMED immediately** and the slot blocks. A payment link is generated → success panel "Booking confirmed" with the link and a Copy button. ⚠️ The copy says "the booking is fully confirmed once they pay", which is inconsistent with the actual status (§18).
4. Validation, client-side first: "Enter the caller's name" / "Enter a phone number" (≥5 characters) / "Pick a space". Server-side (zod): the first message. Pricing errors: "Space has no HALF_DAY package configured" (⚠️ raw enum) or "Set up rates for this space first".
5. **Conflict:** "That slot was just taken." plus **clickable chips**: *Free spaces* (other spaces with capacity for the guest count, up to 3) and *Free dates (same time)*: the same weekday on the next 8 weeks, up to 3. Clicking a chip updates the form; the user then retries.
6. The client record is **matched by phone or email** within the venue. An existing client's name, phone and email are **overwritten** with what was typed (🔒 / ⚠️ the owner isn't told).
7. ⚠️ Add-ons cannot be added in the phone form (the action supports them, but the UI sends `addOns: []`).

### J4. Inquiry → Quote → Accept → Deposit → Confirmed
1. An inquiry arrives (online request-to-book or a phone "Log inquiry").
2. Owner opens the booking (dashboard "New inquiries", Bookings › Inquiries, or calendar) → **Send quote** → status QUOTE_SENT, quote valid **14 days** (fixed; not editable), terms = venue house rules (not editable), email to the client if one exists → notice "Quote sent to the client by email." ⚠️ This notice appears even when no email exists.
3. The client opens `/q/[token]` → reviews it → **Accept & pay $X deposit**.
   - ✗ Expired: "This quote has expired — please contact the venue for a new one." (the button is hidden after expiry, and an amber banner shows instead)
   - ✗ Booking cancelled or expired: rose banner "This booking is no longer active…"
   - ✗ Slot taken since: "Sorry — that date was just booked by someone else. Contact the venue for alternatives."
   - ✓ The booking becomes PENCILED for 7 days, `acceptedAt` is set → Stripe Checkout → on payment, CONFIRMED plus a deposit-receipt email → returns to `/b/[token]?paid=1` ("Payment received — thank you!").
4. ⚠️ If the client abandons Stripe Checkout, the quote is already marked "Accepted". The `/q` page then shows "Accepted on … Go to my booking", and `/b` shows **PENCILED with no Pay button** (the pay button only exists for CONFIRMED). The client has **no self-serve way to retry the deposit**. 🐞 (§19)
5. Re-sending a quote reuses the same quote number and extends its validity.

### J5. Inquiry → Pencil → Confirm
- Booking detail (INQUIRY or QUOTE_SENT) → **Pencil hold** dialog ("Hold for how many days?", 1–30, default 5) → **Place hold** → "Penciled in — the slot is held for N days." ✗ "That slot is already blocked by another booking."
- **Confirm + deposit link** → if INQUIRY or QUOTE_SENT, the booking becomes PENCILED for 7 days → a link is shown in a green box with Copy → "Slot is held. Share the deposit link below — payment confirms the booking." ✗ "Slot already taken".
- ⚠️ Once PENCILED, the detail page **no longer offers "Confirm + deposit link"**. It offers only the active-stage set: balance link, manual payment, cancel. To confirm a penciled booking you must **Record manual payment → Deposit**, or send the *balance* link (which charges the whole remaining amount).
- **Record manual payment** (type Deposit/Balance/Security deposit + amount) → a Deposit on a non-confirmed booking **confirms it**. ✗ "Payment recorded, but the slot is blocked by another booking!"
- When a pencil expires it becomes EXPIRED silently, on the next booking transaction or the daily cron. There is no notification.

### J6. Online instant booking (client)
`/v/[slug]` → **Check availability & book**, a space's **Book this space**, or a day in the availability calendar → `/v/[slug]/book`
1. **Date & time:** Date, Booking type, Start, End, Ends next day, Guest count, Event type → **Check availability**. ✗ "Pick a date for your event." / "End time must be after the start time (or tick "ends next day")." / "How many guests are you expecting?" / "Could not check availability — please try again."
2. **Space:** one card per space with rates, showing Instant booking / Request to book, Available / Unavailable for your time, capacity (with an amber "may be tight for N guests" warning), "Booked that day (incl. setup time): 6:00 PM–11:00 PM…", "Your time: $X incl. tax", and **Choose** (disabled when unavailable or not offered). If the type is not offered, the card shows the raw error, e.g. "Space has no EVENING package configured" ⚠️.
3. **Add-ons:** flat items are an Add / ✓ Added toggle. Per-unit items have a − n + stepper. The running total updates live through a server call.
4. **Your details:** Full name, Email, Phone (⚠️ not marked optional), Notes, and an "I agree to the venue's house rules & policies" checkbox (link opens the venue page in a new tab) → **Review booking**. ✗ "Please fill in your name and a valid email." / "Please accept…".
5. **Review & pay:** line items, subtotal, tax, total; "Due now: 30% deposit $X"; "Balance due by {date} $Y"; security-deposit note; the cancellation policy; **Pay $X deposit** →
   - The server creates a **HOLD** (blocks the slot for **15 minutes**) → "Taking you to secure payment… Your date is held for 15 minutes while you pay the deposit." → Stripe Checkout → success → `/b/[token]?confirmed=1` "Deposit received — booking confirmed!"
   - ✗ The slot was just taken → conflict panel: "That slot was just booked" + "Sorry — that slot was just booked. Here are some alternatives:" + **non-clickable** badges for other spaces and dates ⚠️ + "Choose another date or space" (back to step 1).
   - ✗ Past date → "That date is in the past."
   - ⚠️ **Abandoned checkout:** Stripe's cancel URL is `/b/[token]`. That page shows a HOLD banner, "Complete your payment within 15 minutes", **but there is no button to pay**. 🐞

### J7. Online request-to-book (client)
Same steps 1–4. Step 5's button reads **Send booking request** with the note "This space is request-to-book: the venue will confirm your request before any payment is taken." → an INQUIRY is created (non-blocking) and an acknowledgement email is sent → "**Request sent!** The venue will confirm shortly…" → **View my booking** (`/b`). ⚠️ **The owner receives no email or notification** of new online inquiries. They appear only on the dashboard and in the lists (❓ §25).

### J8. Reschedule (move) a booking
- **Drag:** in Week/Day view, drag a non-tentative bar (HTML5 drag-and-drop, which **doesn't work on touch**) onto another space row or time (snaps to 15 min) → the booking dialog opens and automatically runs **Preview move**.
- **Manual:** click any booking → dialog → "Move this booking" (Space, Date, Ends next day, Start, End) → **Preview move** → "Price unchanged — $X. Confirm to move." (green) or "Price changes: ~~$old~~ → **$new**" (amber) → **Confirm move**. ✗ "That slot is taken." + "Free at that time: Garden Pavilion, …". ✗ "Target space has no rates". Any field change clears the preview.
- 🔒 Add-ons keep their snapshotted prices, and space charges are repriced. ❓ Moving doesn't notify the client, and deposits already paid aren't adjusted.
- ⚠️ Inquiries and quotes can't be dragged, but can be moved through the dialog.

### J9. Balance collection
- **Automatic:** the cron emails reminders on the exact days that are 14 and 3 days before the due date (CONFIRMED bookings with an email and an outstanding balance). The link goes to `/b/[token]?pay=balance`. ⚠️ The `pay=balance` parameter is ignored by the page. The client must find and click "Pay balance".
- **Owner:** dashboard "Send payment link" (in the amber "$X outstanding" strip) or detail **Send balance payment link** → a link is shown and emailed if an email exists. Each click creates a new pending payment row (§10.14).
- **Client:** `/b` → **Pay balance — $X (incl. security deposit)** → Stripe → `?paid=1`.
- 🔒 The balance payment **includes the refundable security deposit** when one is outstanding.
- ⚠️ The Policies setting "Auto-charge balance when due" has **no implementation**; nothing auto-charges (❓).

### J10. Owner cancels
Detail (PENCILED or CONFIRMED, not past) → **Cancel booking** (destructive) → dialog: explanation + "Reason (shared with the client)" → **Cancel booking** → result: "Booking cancelled." Refund to client $X (N% of what they paid, per your cancellation policy), plus "Security deposit refunded in full: $Y" → Done.
⚠️ The refund amount is **shown only after** the irreversible action. There is no preview, unlike the client's flow. INQUIRY and QUOTE_SENT bookings **cannot be cancelled or declined at all** (no action is offered).

### J11. Client cancels
`/b` (active statuses, before the start) → **Cancel booking** → dialog loads a preview: "Cancelling today (N days before your event) refunds **P%** of the $X you've paid = **$Y**." + "Any security deposit you've paid is always refunded in full." + optional reason → **Cancel booking** → "Booking cancelled. A refund of $Z (P% of payments plus your full security deposit) is on its way back to your card." or "Per the venue's policy, no refund applies at this notice period." ✗ "Already cancelled" / "This event has already started".

### J12. After the event
- The cron marks past CONFIRMED bookings **COMPLETED** and sends a thank-you email (with "security deposit will be reviewed and refunded within 7 days" when one is held).
- Detail page (CONFIRMED-past or COMPLETED): **Mark no-show** (CONFIRMED-past only; no confirmation dialog ⚠️) and **Settle security deposit** (disabled with "No security deposit is currently held for this booking." when none is held).
- Settle dialog: add deduction rows (reason + $ amount, removable) → live "Will refund $X of $Y held (keeping $Z)." → **Refund & settle** → result "Refunded to client / Kept for damages" → an email with itemised deductions. 🔒 Deductions are capped at the held amount. ⚠️ Settling can be repeated? Once settled, `securityHeld` drops to 0, so the button disables.

### J13. Tours
Client `/v/[slug]/tour` → name, email, phone (optional), space (optional, default "Whole venue"), date, time (09:00–18:30 in 30-minute slots) → **Request this tour** → "Tour requested!". ✗ "Pick a future time". The owner is emailed (only if the venue has a contact email) with a "Confirm or decline" button → `/app/[v]/tours` (or the dashboard card) → **Confirm** (emails the client) / **Decline** (⚠️ no email to the client) → later **Mark completed** / **Cancel** (no email). No reschedule, no conflict check against bookings or other tours.

### J14. Spaces & rates
Spaces → **Add space** → form → **Create space** (✗ plan limit: "Your SOLO plan allows up to 1 space — upgrade to add more.") → redirect to the space detail page → **Rates** form → **Save rates** ("Enter an hourly rate — it's the base for all pricing."). **Deactivate space** → confirm dialog → back to the list with an "Inactive" badge. 🔒 **No reactivation in the UI** ("reach out to support"). ⚠️ No reordering, no delete, no duplicate.

### J15. Add-ons
Add-ons → **Add add-on** → dialog (Name, Description, Price, Charged: Flat fee (once) / Per unit, Max quantity (disabled for flat), Active) → **Save add-on**. Edit → same dialog plus a **Remove** button (native `confirm("Remove this add-on? It stays on past bookings.")`), which actually sets it to *inactive*: the same thing as unticking Active ⚠️.

### J16–J19. Settings
- **General:** a single form → "Venue details saved."
- **Policies:** → "Policies saved." / "Include a "0+ days" row…".
- **Branding:** colour presets, a colour picker and hex input; logo URL; photo URLs → "Branding saved." (Save is disabled while the hex is invalid).
- **Payments:** three states (not connected → **Connect Stripe**; onboarding unfinished → **Resume onboarding**; connected → green confirmation + account id) + "How fees work".
- **Billing:** current plan badge (+ trial end date) + 3 plan cards → **Choose X** → Stripe subscription Checkout (dev: instant plus a banner "You're now on the Growth plan."). ⚠️ No downgrade, cancel or invoice management, although the landing FAQ promises "downgrade or cancel from your billing settings".
- **Team:** member list (name/email + role badge) + invite (Email, Role Staff/Manager/Owner) → "Member added. They can sign in with a magic link sent to their email — no password needed." ⚠️ **No email is actually sent**. No remove, no role change except re-inviting with a new role, no pending state, no protection for the last owner.

### J20. Multi-venue
A user with ≥2 memberships: `/app` shows a picker of cards (colour circle, name, /slug, ROLE badge) and **+ New venue**. Inside a venue, a `<select>` switcher sits in the sidebar header. ⚠️ With exactly one venue, there is **no way to reach "New venue"** except typing `/app/new`.

### J21. Super-admin impersonation
`/admin` → venues table → **Impersonate →** → `/app/[slug]` with an amber banner. Every page load writes an audit-log row (in fact two per page: layout plus page). Back to `/admin` only by typing the URL.

### J22. Day-of operations (Staff)
Dashboard → upcoming event card → tap **Setup** / **Teardown** pills to toggle (green check when done). No timestamp, no "who did it".

### J23. Client record maintenance
Clients → search → open → edit Name, Phone, Email, Organization, Notes ("only your team sees these") → **Save changes** → "Saved." ⚠️ No create, merge or delete. Clients are created implicitly by bookings.

### J24. Payment & refund hand-offs (external)
Stripe Checkout (deposit, balance, subscription) and Stripe Connect onboarding are **hosted by Stripe**. Return URLs: `/b/[token]?paid=1`, `/b/[token]?confirmed=1`, `/app/[v]/settings/billing?subscribed=1` (⚠️ no banner is rendered for `subscribed=1`; only `dev_subscribed` has one), `/app/[v]/settings/payments?connected=1|refresh=1` (⚠️ neither has a banner).

---

## 10. Screen-by-Screen Specification

> Format: every screen uses the same fields. "n/a" means the element doesn't exist on that screen. "None" means it should arguably exist but doesn't. Screenshot numbers refer to §22.

### 10.1 Screen: Marketing landing
- **Route:** `/` · **Accessible by:** everyone · **Screenshots:** 001 (desktop), 009 (mobile), 017 (tablet)
- **Purpose:** convert venue owners into trial sign-ups.
- **Primary user goal:** understand the value, then start a free trial. **Secondary:** see pricing, see a live demo venue, sign in.
- **Current layout:** single long page, max width 6xl, centred.
- **Header:** wordmark; Pricing (hidden < sm), Sign in, **Start free trial**.
- **Navigation:** anchor `#pricing` only.
- **Main content, in order:** (1) Hero: pill "Booking software for event halls & venues", H1 "Never double-book your hall again", subcopy, **Start free trial →** and **See a live venue page** (hard-coded to `/v/regency-event-center` 🔒 ❓ must exist in production), plus "30 days free on every plan · No credit card required". (2) "How Venuora works": 3 numbered cards. (3) "Everything a hall needs. Nothing it doesn't.": 6 feature cards with Lucide icons. (4) Pricing: 3 plan cards (Growth highlighted "Most popular"), "Included in every plan" list of 11 items, 3 "money, plainly" cards (3% online fee, phone/cash free, your Stripe). (5) FAQ: 6 Q&As, always expanded (a `<dl>`, not an accordion). (6) A dark (zinc-950) CTA band. (7) Footer.
- **Sidebar:** n/a · **Footer:** tagline, links, ©.
- **Primary CTA:** Start free trial (appears 5 times). **Secondary:** See a live venue page, Sign in.
- **Information hierarchy:** hero › steps › features › pricing › FAQ.
- **Forms / Tables / Filters / Search / Pagination / Dropdowns / Modals / Tooltips / Notifications:** n/a.
- **Conditional UI:** none. Fully static and server-rendered.
- **Permissions:** none. ⚠️ Signed-in users still see "Sign in" / "Start free trial"; there is no "Go to dashboard".
- **States:** loading n/a; empty n/a; error n/a; success n/a.
- **Mobile:** CTAs stack. Grids collapse to 1 column. Pricing cards stack. No hamburger.
- **Tablet:** 2-column feature grid. Pricing stays 3 columns from `md` (768px) and gets cramped at 768–900px.
- **Desktop:** 3-column grids.
- **Existing visual problems:** generic SaaS look. Every card has the same weight. No imagery or product screenshots at all. The single gradient blob is the only decoration. The FAQ is a wall of cards.
- **Existing UX problems:** no product visuals; "See a live venue page" is the only proof. Plan cards say "All features included", but the in-app Billing page lists different features per plan (§18 C-3).
- **Must survive redesign:** the plan prices and space limits ($49 / 1, $99 / 5, $199 / 10), the 30-day trial message, the 3% online fee disclosure, "your money goes to your Stripe", the FAQ content, and the link to the live demo venue.
- **Designer considerations:** this is the only Venuora-branded page with room for brand expression. It sets the tone for the whole product.

### 10.2 Screen: Sign in
- **Route:** `/login` · **Accessible by:** everyone · **Screenshots:** 002, 010 (mobile), 018 (error)
- **Purpose:** authenticate an existing user.
- **Primary goal:** get into the app. **Secondary:** go to register.
- **Layout:** centred column, max-w-md, on zinc-50: wordmark › **Card 1 "Sign in with a magic link"** (Email + "Email me a sign-in link") › "— or —" › **Card 2 "Sign in with a password"** (Email, Password, "Sign in") › "New to Venuora? Start your free trial".
- **Forms:** two independent forms (§11 F1, F2). The email isn't shared between them, so users must type it twice if they switch method.
- **Buttons:** full-width indigo submit with a spinner while pending.
- **Error state:** rose alert box *inside* the card, above the fields: "Invalid email or password" / "Enter a valid email" / "Could not send the magic link".
- **Success state:** password → redirect to `/app`. Magic link → `/login/check-email`.
- **Loading:** button disabled with a spinner.
- **Missing:** "Forgot password?", show-password toggle, remember-me, any message when arriving from a protected page (it just redirects silently), and any handling of the Auth.js `?error=` parameter.
- **Mobile:** works. The two cards make the page long. Both cards are equal weight.
- **Existing UX problems:** two equal-weight sign-in methods confuse first-time users. Magic link is listed first even though the demo and most owners use passwords.
- **Must survive:** both methods. Magic link is the "primary" method in the code comments (`schema.prisma: passwordHash // password fallback; magic link is primary`).

### 10.3 Screen: Check your inbox
- **Route:** `/login/check-email` · **Screenshot:** 020
- **Purpose:** confirm the magic link was sent.
- **Content:** mail icon, H1 "Check your inbox", "We've sent you a sign-in link. Click it on this device to continue — the link expires after a short while.", a grey box "**Dev note:** in local development the link is printed to the server console." ⚠️ (**shown in production too**), "Back to sign in".
- **Missing:** the email address it was sent to, a resend option, a "use password instead" link, and a "check spam" hint.
- **Must survive:** the instruction to open it on the same device.

### 10.4 Screen: Register (Start your free trial)
- **Route:** `/register` · **Screenshots:** 003, 011 (mobile), 019 (error)
- **Purpose:** create an account.
- **Fields:** Your name (placeholder "Ada Okafor"), Email ("you@yourvenue.com"), Password (min 8; helper "At least 8 characters.").
- **Primary CTA:** Start free trial. **Secondary:** "Already have an account? Sign in".
- **Error:** in-card alert, the first error only. ⚠️ zod's default wording for name and password errors.
- **Success:** auto sign-in → `/app` → `/app/new`.
- **Missing:** terms/privacy consent, password visibility toggle, and any indication of what happens next beyond "You'll set up your venue right after."
- **Edge case 🔒:** an invited team member who never set a password can "register" with the same email; this sets their password and name.

### 10.5 Screen: Your venues (venue picker)
- **Route:** `/app` · **Accessible by:** signed-in users · **Screenshots:** 040, and dark-mode variant at the end of the index
- **Behaviour:** 0 venues → redirect to `/app/new`. 1 venue → redirect to `/app/[slug]`. ≥2 → this page.
- **Layout:** max-w-3xl column: H1 "Your venues", "Pick a venue to manage.", **+ New venue** (top right). Below that, a 2-column grid of cards: brand-colour circle, venue name, `/slug`, role badge (raw "OWNER" / "MANAGER" / "STAFF" in caps ⚠️).
- **No app shell:** no sidebar, sign out, account info or logo.
- **Existing visual problems:** 🐞 in OS dark mode the page column is zinc-50 but the area outside it shows the dark body background (#0a0a0a), giving a grey strip on black (screenshot "app-venue-picker-dark"). The `<main>` sets its own bg only within max-w-3xl.
- **Missing:** venue status (published / draft / trial), the next booking, and sign out.
- **Must survive:** the role shown per venue, the New venue entry point.

### 10.6 Screen: Create your venue
- **Route:** `/app/new` · **Screenshots:** 041, plus a dark-mode variant
- **Purpose:** create a tenant. **Fields:** Venue name (2–120 characters, autofocus, placeholder "e.g. The Garden Hall"); Timezone (select of 26 IANA zones shown as "America/New York", default America/New_York; helper "All bookings and availability are shown in this timezone.").
- **CTA:** Create venue → "Creating…". **Error:** rose box "Give your venue a name".
- **Missing:** a way back (no link to `/app` or sign out), currency (fixed USD 🔒 ❓), and a preview of the public URL/slug that will be generated (the slug is **not editable anywhere** 🔒).
- **Designer considerations:** the timezone choice determines how every time is displayed. Present it in human terms (city or region), and pre-select the browser's timezone if that is feasible client-side.

### 10.7 Screen element: Owner app shell (layout for all `/app/[venueSlug]/**`)
- **Files:** `app/app/[venueSlug]/layout.tsx`, `components/app-shell/sidebar.tsx` · **Screenshots:** every owner screen; mobile menu: "nav-menu-open-mobile/tablet"
- **Contains:** the sidebar or mobile top bar (§8.3), the impersonation banner, the "Setup incomplete" banner, and a `<main>` with max-w-6xl and padding.
- **Background:** zinc-50 with white cards.
- ⚠️ **Double padding.** Most child pages wrap themselves in `mx-auto max-w-* p-4 sm:p-6` *inside* the shell's already-padded `<main>`. The result is inconsistent page widths (6xl, 5xl, 4xl, 3xl) and extra gutters. Pages also use two different title scales: dashboard and calendar use `text-2xl`, all other pages `text-xl`.
- ⚠️ The "Setup incomplete" banner shows to Staff and Managers, but links to an Owner-only page (404).
- ⚠️ There is no indication of who is signed in.
- **Mobile:** the slide-over has no focus trap or Escape handling. The page behind can still scroll.

### 10.8 Screen: This week (dashboard)
- **Route:** `/app/[v]` · **Accessible by:** all venue roles · **Screenshots:** 042 (owner), manager, staff, empty, mobile, tablet, impersonation
- **Purpose:** daily operational overview.
- **Primary goal:** see what's happening in the next 7 days and act on money and leads. **Secondary:** handle tour requests and new inquiries.
- **Header:** H1 "This week", "The next 7 days at {Venue} — times shown in America/New York."
- **Main content:**
  1. **3 stat tiles:** "Confirmed this month" (count of CONFIRMED + COMPLETED with a start date in this calendar month), "Collected this month" (successful deposit + balance payments this month; refunds are **not** subtracted ⚠️), "Pending inquiries" (all-time INQUIRY count). Tiles are not clickable.
  2. **Upcoming events**: PENCILED and CONFIRMED bookings starting from today through +7 days. Two-column cards: client name (link to the detail page, which Staff → 404 🐞), space colour dot · space · event type, status badge, date and time range (cross-midnight shows the weekday), guest icon + count, **Setup / Teardown** toggle pills (all roles), and an amber strip "$X outstanding" + **Send payment link** (Managers+) when unpaid. Empty state: "Nothing penciled or confirmed in the next 7 days. *Open the calendar* to add a booking."
  3. **Tour requests**: the PENDING tours (up to 8, oldest first): name, date and time · phone, **✓ Confirm** (green) / **Decline** (Managers+). Empty: "No pending tour requests." ⚠️ Past-dated pending tours still show.
  4. **New inquiries**: the latest 6 INQUIRY bookings: name, space dot · space · type · date, a "New" badge and an arrow, whole row links to the detail page. Empty: "No open inquiries. Nice and tidy."
- **Forms:** each toggle and button is its own tiny server-action form. ⚠️ No feedback beyond a re-render. "Send payment link" **creates a link and emails it, but never shows the link**; the page just refreshes.
- **Conditional:** Staff see no payment or tour buttons. Penciled events show the same card as confirmed ones; the hold expiry is not shown.
- **Loading:** none (server render). **Error:** framework error page.
- **Mobile:** single column. Stat tiles stack (3 tall cards before any events ⚠️).
- **Existing UX problems:** "This week" is really "next 7 days". Nothing shows *today* specifically. No overdue-balance list, no expiring pencils, no quotes awaiting response. The stat tiles mix "this month" with "all time".
- **Must survive:** the next-7-days events with checklist toggles, the outstanding amount with the payment-link action, pending tours with confirm/decline, new inquiries, and the 3 metrics (or better ones that use existing data).
- **Designer considerations:** this is the screen owners open most. Design it as "Today / This week / Needs attention".

### 10.9 Screen: Set up your venue (onboarding)
- **Route:** `/app/[v]/onboarding` · **Accessible by:** OWNER (others 404) · **Screenshots:** "onboarding-complete", "empty-onboarding", "empty-onboarding-publish-error"
- **Purpose:** guide a new owner to a bookable, published venue.
- **Header:** H1 "Set up your venue" (`text-xl`), "Seven quick steps and you're taking bookings. You can leave and come back any time — your progress is saved."
- **Progress:** "N of 7 steps done" + % + an indigo bar.
- **Steps** (vertical list of cards; done = emerald border + check circle; otherwise the number in an indigo circle): (1) **Your venue details**: the full General form embedded; (2) **Add your first space** → "Add a space" / "Add another space"; (3) **Set your rates** → "Go to spaces"; (4) **Add-ons** (badge "Optional") → "Set up add-ons" (the only working link to `/addons`); (5) **Booking policies** → "Review policies"; (6) **Connect Stripe for online payments** → "Connect Stripe" / "Resume Stripe onboarding" (a form submit that redirects to Stripe); (7) **Publish your venue page**: shows `http://…/v/slug` in code font, a large "Publish my venue page" button, then a green success panel with 🎉 "Your venue page is live!", share copy ("WhatsApp, Instagram bio, flyers"), the URL link and a **Copy** button.
- **Error:** "Add at least one space before publishing" (rose box above the button).
- **Conditional:** button variants switch between primary and outline depending on whether the step is done.
- **Rules 🔒:** completion flags come from data, not order. Steps can be done in any order. The "Setup incomplete" banner disappears only when published (`onboardingStep = 99`).
- **Existing UX problems:** step 1 is a full form inline while the other steps are links away, with no return path. Done steps can't be collapsed. Step 3 "done" counts any space with rates. Publishing doesn't require rates or Stripe, and nothing explains the consequences (§9 J1).
- **Must survive:** all 7 steps, the progress indicator, the publish action with the shareable link and copy, and the optional marker on add-ons.

### 10.10 Screen: Calendar — Month view
- **Route:** `/app/[v]/calendar` (default) `?view=month&date=` · **All roles** · **Screenshots:** 043, mobile/tablet month, staff week
- **Purpose:** see occupancy and take phone bookings.
- **Header:** H1 "Calendar", "All times in America/New York. Click an empty slot to book while the caller is on the line."
- **Toolbar:** Month | Week | Day segmented control (indigo active), ‹ Today ›, the title "October 2026", **New booking** (Managers+, right-aligned).
- **Grid:** a 42-cell Sunday-first month. Out-of-month days are greyed and today has an indigo circle. **Each cell shows up to 3 booking chips + "+N more"** (→ Day view). A chip shows a status-colour dot, a time ("9:00am") and the client name, truncated, on a tinted *space-colour* background with a 3px space-colour left border. Tentative (inquiry/quote) chips are dashed at 70% opacity. Tooltip (`title`): "Name — Event (Status)".
- **Interactions:** click empty cell → New booking dialog prefilled with that date and the first space (Managers+; for Staff the cursor still says pointer but nothing happens ⚠️). Click a chip → Booking dialog. "+N more" → Day view.
- **Legend card** (below): Status colours (7), Key (hatched buffer, dashed tentative, ‹ › continues), Spaces colours (month only).
- **Empty:** dashed box "Add a space first — the calendar shows one row per space." (no link ⚠️).
- **Mobile:** 7 columns at 390px (~50px each). Chips become unreadable 2–4 character stubs. The toolbar wraps onto 2–3 lines.
- **Existing UX problems:** **two colour systems in one chip** (space colour as background and border, status colour as dot) are hard to decode. There are no filters (by space or status). Cancelled bookings are hidden with no toggle. Times use "9:00am", which differs from "9:00 AM" elsewhere.
- **Must survive:** all three views, URL-driven navigation, click-to-book, the tentative vs blocking distinction, and the legend meanings.

### 10.11 Screen: Calendar — Week & Day timeline
- **Route:** `?view=week` / `?view=day&date=` · **Screenshots:** week, day, mobile week, staff week
- **Layout:** a horizontally scrollable grid. Rows = spaces (sticky 128px label column with colour dot and name). Columns = days; each day spans **06:00 → 02:00 the next day** (20 hours). Hour ticks every 2h, labelled every 6h in Week view and every 2h in Day view. Week view = 13px per hour (a whole week is about 1,950px wide), Day view = 46px per hour.
- **Booking bars:** absolutely positioned. **Hatched translucent ends = setup/teardown buffers** (🔒 required by AGENTS.md). The solid core is the event in its *status* colour, with the label "Client — Event type" on top (text colour auto-contrasted). Inquiries and quotes are dashed outlines with a transparent core. Bars clipped at the window edge show ‹ or ›.
- **Interactions (Managers+):** click an empty area → New booking at that time (snapped to 30 min, 2h long, crosses midnight if needed). **Drag** a confirmed/penciled/hold bar to another row or time → Booking dialog with an automatic move preview (snapped to 15 min). Bar click or Enter → Booking dialog.
- ⚠️ Bookings outside 06:00–02:00 are clipped. HTML5 drag doesn't work on touch devices. No current-time line. Week view text is tiny: 10–11px labels, and bars are ~50px wide for a 4h event.
- **Must survive:** buffer visualisation, per-space rows, cross-midnight handling, drag-to-move with a confirmation step, and click-to-book.

### 10.12 Dialogs: Calendar — New booking (fast phone form) & Booking quick view / Move
- **Files:** `calendar/new-booking-dialog.tsx`, `calendar/booking-dialog.tsx` · **Screenshots:** new booking (desktop, mobile), validation error, booking dialog (owner, staff), move preview
- **New booking dialog** (max-w-xl, native `<dialog>`, scrolls inside at 85vh): title "New booking", description "Fill this while the caller is on the line — pick an exit below." Field order: Client name | Phone · Email (optional) · Space | Event type · Slot | Date · Start | End | ☐ Ends next day · Guest count | Notes (a one-row textarea). **Four exits** in a 2×2 grid at the bottom: [Log inquiry] [Send quote] / [Pencil hold][__ days] [Confirm + deposit link]. These are all small (`h-8`) buttons, and the "most important" one isn't obvious ⚠️. Error box with clickable alternative chips. **Success state:** "Booking confirmed" + a deposit-link field + Copy/Copied + Done. Full field spec in §11 F18.
  - ⚠️ No live price shown while filling in the form, although the server can price it (the public wizard does).
  - ⚠️ No client lookup or autocomplete. Typing an existing phone number silently merges into and overwrites that client.
  - ⚠️ No Cancel or Close button in the form state; only Esc or a backdrop click.
- **Booking dialog** (max-w-md): Client name (title) + status badge; "Event · Slot label · Space"; date and time range + guests; tel: link; "Total $X · Deposit $Y"; **Open booking ↗** (Staff → 404 🐞). Managers+ also see a **"Move this booking"** section: Space, Date, ☐ Ends next day, Start, End, the preview result box, then [Preview move] → [Confirm move] and [Close].
  - States: "Checking…", "Moving…", the error box with "Free at that time: …", green "Price unchanged — $X. Confirm to move.", amber "Price changes: ~~$old~~ → $new".
- **Must survive:** the 4 exits, pencil days, alternatives on conflict, the deposit-link hand-off, the move preview before applying, and the reprice disclosure.

### 10.13 Screen: Bookings list
- **Route:** `/app/[v]/bookings?status=&q=` · **All roles** · **Screenshots:** all, inquiries tab, search no results, mobile, staff
- **Purpose:** find any booking.
- **Header:** H1 "Bookings", "Every inquiry, quote and confirmed event in one place." ⚠️ No "New booking" button here; creation happens only in the calendar.
- **Filters:** pill tabs **All · Inquiries · Quotes · Penciled (includes checkout HOLDs) · Confirmed (future) · Past (completed, no-show, confirmed-but-ended) · Cancelled (includes EXPIRED holds)**. There are no counts on the tabs ⚠️.
- **Search:** "Search by client name or phone…" + Search button (icon-only on mobile). Matches name (case-insensitive) or phone substring, **not email**, although Clients search does include email ⚠️.
- **Table (≥ md):** Date (link, "Sat, Oct 17 2026" + "5:00 PM – 11:00 PM") · Client (name + phone) · Space · Event · Status badge · Total · Paid (green) · Balance. Sorted by **start date, newest first** (⚠️ future and past interleaved under "All").
- **Mobile cards (< md):** name, date/time, status, "Space · Event", "Paid $X of $Y", "$Z due".
- **Pagination:** none. **Hard cap 200 rows** with no indication of truncation ⚠️.
- **Sorting:** none (fixed). **Empty:** "No bookings match your search." / "No bookings here yet. New inquiries and bookings will show up automatically."
- **Staff:** sees the list, but every row link → 404 🐞.
- **Must survive:** status filters (same groupings), search, the money columns (total / paid / balance), mobile cards.

### 10.14 Screen: Booking detail
- **Route:** `/app/[v]/bookings/[id]` · **MANAGER+** · **Screenshots:** confirmed, inquiry, quote sent, penciled, completed, cancelled, no-show, balance-link created, mobile, tablet; dialogs: manual payment, cancel, pencil, settle
- **Purpose:** the full record of one booking and every lifecycle action.
- **Header:** "← All bookings", H1 "{Client} — {Space}" + status badge, "Event type · Slot label · N guests".
- **Main column (2/3):**
  1. **Event time** card: "Sat, Oct 17 2026 at 5:00 PM — 11:00 PM" (⚠️ the end shows no date for cross-midnight events), "All times shown in the venue's timezone (America/New_York).", a grey box "Including setup and teardown buffers: **access from 4:00 PM / out by 12:00 AM** (60 min setup · 60 min teardown)", the amber "Hold expires …" (PENCILED/HOLD), the rose "Cancelled {date} — {reason}", and a bordered Notes box (owner notes plus system warnings such as "⚠ Deposit paid but slot conflict on confirm — needs attention." 🔒 must stay visible).
  2. **Price breakdown** card: a table (Item · Qty · Unit · Total), Subtotal, Tax, **Total**, "Paid so far" (green), "Balance remaining", "Balance due by …", "Refundable security deposit: $X — $Y currently held / not held yet."
  3. **Payments** card: a table (Type · Amount · Status (coloured text) · Date · Note) or "No payments yet." ⚠️ **PENDING rows accumulate.** Every generated link (deposit or balance) creates a PENDING row that is never cleaned up unless Stripe expires it, so the table fills with "Pending" noise. Refunds are listed as positive amounts.
- **Side column (1/3):**
  1. **Client** card: name (link to the client page), tel:, mailto:, organisation.
  2. **Actions** card: status-dependent (see the matrix below), plus inline green/rose notices and generated-link boxes (green "Deposit payment link" / indigo "Balance payment link" with Copy).
  3. **Client booking page** card: "The client can view their booking, pay, and download documents at this private link…" (⚠️ there are **no documents** to download) + the URL in code style + Copy.

| Status / timing | Actions shown |
|---|---|
| INQUIRY, QUOTE_SENT | **Send quote** · Pencil hold (dialog) · **Confirm + deposit link** (green) |
| PENCILED or CONFIRMED, not past | **Send balance payment link** · Record manual payment (dialog) · **Cancel booking** (red, dialog) |
| CONFIRMED and past | Mark no-show · Settle security deposit (dialog; disabled + note when nothing is held) |
| COMPLETED | Settle security deposit |
| HOLD, EXPIRED, CANCELLED, NO_SHOW | "No actions available for this booking's current status." |

- **Dialogs:** Pencil hold, Manual payment, Cancel (+ result view), Settle security (+ result view). Specs in §11 F20–F23.
- **Missing (⚠️, do not invent, but flag):** edit booking fields; move/reschedule (only in the calendar); decline or cancel an inquiry; resend a confirmation; view or resend the quote (no link to `/q/…` is shown to the owner); activity history; who did what.
- **Mobile:** columns stack; actions come *after* three long cards ⚠️; tables scroll sideways.
- **Must survive:** every action in the matrix and its status gating (🔒), the buffer access times, the hold expiry, the payment ledger, the manage-link sharing, system warnings in notes.

### 10.15 Screen: Clients list
- **Route:** `/app/[v]/clients?q=` · **All roles** · **Screenshots:** desktop, mobile, empty
- **Header:** "Clients", "Everyone who has booked or inquired — with their lifetime spend at your venue."
- **Search:** name / phone / email / organisation.
- **Table:** Name (link) · Phone · Email · Organization · Bookings (count, all statuses) · Lifetime spend (deposits + balances paid; refunds **not** subtracted ⚠️). Sorted A–Z. **Cap 300**, no pagination.
- **Mobile cards:** name, "phone · email" or "No contact info", spend, "N bookings".
- **Empty:** "No clients yet — they're created automatically with each booking." / "No clients match your search."
- **Missing:** create, merge, export, delete. Staff row links → 404 🐞.

### 10.16 Screen: Client detail
- **Route:** `/app/[v]/clients/[id]` · **MANAGER+** · **Screenshot:** client-detail
- **Header:** "← All clients", H1 name, "N bookings · lifetime spend $X".
- **Left (2/5):** "Contact details", "Keep this up to date so quotes and reminders reach them.", then the form: Name*, Phone, Email, Organization, Notes ("only your team sees these") + Save changes → "Saved." / error.
- **Right (3/5):** "Booking history": rows with date and time, "Space · Event", total, "$X paid", status badge; each row links to the booking. Empty: "No bookings yet."
- 🔒 Editing the email changes where future quotes and reminders go.

### 10.17 Screen: Tour requests
- **Route:** `/app/[v]/tours` · **MANAGER+** (Staff 404) · **Screenshots:** desktop, mobile
- **Header:** "Tour requests", "People who want to come see the venue before booking. Confirming sends them an email automatically."
- **Three cards:** **Pending (N)** "Waiting on your confirmation." · **Upcoming** "Confirmed visits on the calendar." (⚠️ they are *not* on the calendar) · **Past** (everything else, newest first).
- **Row:** name + status badge (Pending amber / Confirmed green / Declined rose / Completed grey / Cancelled light grey), "{date at time} · 30-minute viewing · {space}", "email · phone", "notes" in quotes. Buttons: Pending → **Confirm** (green) / Decline. Confirmed → **Mark completed** / Cancel (ghost). ⚠️ Confirmed tours whose time has passed drop into "Past" but **still show** Mark completed / Cancel.
- **Empty states:** "Nothing pending — nice and tidy." / "No upcoming tours." / "No past tours yet."
- **Missing:** reschedule, contact links (email and phone are not clickable), conflict awareness, notes for the owner.

### 10.18 Screen: Spaces list
- **Route:** `/app/[v]/spaces` · **MANAGER+** · **Screenshots:** desktop, empty
- **Header:** "Spaces", "The rooms and halls clients can book. Each has its own rates and buffers." + **Add space**.
- **Grid (1/2/3 columns):** card = first photo (h-36) or a gradient in the space colour with a dot; name; badge (Inactive / ⚡ Instant book / none for request-to-book ⚠️ asymmetry); "N seated · N standing"; "60m setup / 60m teardown"; "from $X/hr" (the base hourly rate only, which ignores packages and differs from the public "from" price ⚠️) or amber "No rates set yet — add them".
- **Sort:** active first, then by sort order. Inactive spaces stay listed.
- **Empty:** "No spaces yet. Add your first space — it takes about two minutes." + **Add your first space**.
- **Missing:** plan usage ("2 of 5 spaces used"), reorder, reactivate.

### 10.19 Screen: Add a space
- **Route:** `/app/[v]/spaces/new` · **MANAGER+** · **Screenshot:** space-new
- "← All spaces", H1 "Add a space"; card "Space details", "Save the basics first — you'll set the rates on the next screen."; the Space form (§11 F12) with **Create space**.
- **Errors:** zod first message; plan limit "Your SOLO plan allows up to 1 space — upgrade to add more." (no link to Billing ⚠️).
- **Success:** redirect to the space detail page.

### 10.20 Screen: Space detail (edit space, rates, deactivate)
- **Route:** `/app/[v]/spaces/[id]` · **MANAGER+** · **Screenshots:** desktop, mobile, deactivate dialog
- **Sections:** (1) **Space details** card: Space form + Save space ("Space saved."). (2) **Rates** card: "How this space is priced. Changes only affect new bookings — existing prices never change." (🔒) or "Set the rates so this space can be booked and quoted."; Rate plan form (§11 F13) + Save rates ("Rates saved."). (3) **Danger zone** (active only): "Deactivating hides this space from clients. Existing bookings are untouched." + **Deactivate space** (red) → dialog "Deactivate {name}? The space is hidden from your public page and can't take new bookings. Existing bookings stay exactly as they are. You can reach out to support to reactivate it later." [Keep it active] [Yes, deactivate].
- **Inactive space:** header badge "Inactive"; danger zone hidden; still editable.
- ⚠️ This is a very long page on mobile, with two separate Save buttons. Unsaved changes in one form are lost if the other is saved (`router.refresh`).
- **Must survive:** every field, both forms, the price-snapshot reassurance, the deactivate confirmation.

### 10.21 Screen: Add-ons
- **Route:** `/app/[v]/addons` (🐞 the sidebar links to `/add-ons` → 404) · **MANAGER+** · **Screenshots:** desktop, mobile, broken link 404, edit dialog, empty
- **Header:** "Add-ons", "Extras clients can add to any booking — equipment, services, staff. They show up on quotes and invoices automatically." (⚠️ there are no invoices; and add-ons cannot be added in phone bookings).
- **Toolbar:** **+ Add add-on** (right).
- **Table:** Name (+ truncated description) · Price · Charged (Per unit / Flat fee) · Max qty (or —) · Status (Active green / Inactive grey) · Edit (ghost).
- **Dialog:** "New add-on" / "Edit add-on" + description; Name, Description (optional), Price ($), Charged (Flat fee (once) / Per unit), Max quantity (disabled when flat; placeholder "No limit"), ☐ Active — clients can select this add-on; footer [Remove] (red, edit only, native confirm) … [Close] [Save add-on].
- **Empty:** "No add-ons yet. Add extras clients can book — chairs, projector, cleaning, catering…".
- ⚠️ Mobile: the 6-column table scrolls sideways (no card fallback, unlike Bookings and Clients). "Remove" and "Active" mean the same thing.

### 10.22 Screen element: Settings layout
- **File:** `settings/layout.tsx` · **OWNER only** (Managers and Staff → 404 even though Settings is in their sidebar).
- H1 "Settings", "Your venue's details, policies and payments — all in one place." + a horizontal tab row (§8.4). Each tab renders one or more cards below. Width max-w-3xl.

### 10.23 Screen: Settings › General
- **Route:** `/app/[v]/settings` · **Screenshot:** settings-general
- Card "Venue details", "Contact details and address — used on quotes, emails and your public page." Form (§11 F5): Venue name*, Timezone (19 options + the current one if it's unlisted ⚠️ a different list from Create venue), Contact email, Phone, Street address, City, State / Region, Postal code, Country (2-letter code), Description (shown on your public page) → **Save details** → "Venue details saved."
- 🔒 Contact email receives tour-request notifications and is the reply-to on every client email. Phone and email are shown to clients on `/b`, in emails and on `/q`. ⚠️ Changing the timezone re-interprets how every existing booking is displayed, and there is no warning.
- ⚠️ `addressLine2` exists in the data and is shown on the public page, but there is no input for it.

### 10.24 Screen: Settings › Policies
- **Route:** `/app/[v]/settings/policies` · **Screenshots:** desktop, mobile
- Card "Booking policies", "Deposits, due dates, tax and cancellations. Changes apply to new bookings only." (🔒 partially true: the deposit and balance date are snapshotted, but **cancellation tiers are read live** at cancel time, so a change affects existing bookings ❓ §25).
- Fields (§11 F6): Deposit % · Balance due (days before) · Security deposit ($) · a checkbox card whose label flips between "Auto-charge balance when due" and "Send payment link reminders" (⚠️ auto-charge is not implemented) · Tax rate % · House rules (textarea) · **Cancellation policy** repeater: [N] "+ days before" → [P]% "refund" [🗑], up to 6 rows, + Add tier, example text.
- Validation: must include a 0-day tier ("Include a "0+ days" row so every cancellation has a rule — even a last-minute one (it can be 0% refund).").
- ⚠️ No preview of how the policy reads to clients (the public page has a sentence renderer, `cancellationSentences`, which could be reused).

### 10.25 Screen: Settings › Branding
- **Route:** `/app/[v]/settings/branding` · **Screenshot:** settings-branding
- Card "Branding", "Make your public page and emails look like you — not like software." Fields: **Brand color** (8 preset swatches + native colour picker + hex input; inline error "Use a 6-digit hex color like #4f46e5."), **Preview** (a brand-coloured bar with logo/initial + name, and a white row with a "Book now" pill), **Logo URL** (text), **Venue photos** (URL repeater, max 20) → **Save branding** (disabled while the hex is invalid).
- ⚠️ **No file upload anywhere in the product.** Logos and photos are pasted URLs with no thumbnail preview for photos and no validation feedback until save ("Invalid URL" from zod).
- ⚠️ The preview doesn't match the real header (the real public header is white with a thin brand bar; the email header *is* a full colour bar).
- ⚠️ No contrast check: a light brand colour (e.g. amber `#f59e0b`) with white button text fails WCAG on every client page.

### 10.26 Screen: Settings › Payments
- **Route:** `/app/[v]/settings/payments` · **Screenshots:** connected, not connected
- **States:** (a) **Connected**: green box "Connected — you can take payments", "Deposit and balance links, and instant-book checkout, all work.", "Stripe account: acct_…". (b) **Onboarding not finished**: amber box + **Resume onboarding**. (c) **Not connected**: grey box "Not connected yet… you'll need your bank details." + **Connect Stripe**. Always: a "How fees work" box (3% on deposits and balances; no fee on security deposits or manual payments).
- **Hidden behaviour:** `?dev_onboarded=1` auto-marks connected (dev). `?connected=1` / `?refresh=1` from Stripe show **no feedback** ⚠️.
- ⚠️ When not connected, nothing elsewhere stops the owner from generating payment links. In production, links on an unconnected venue fall back to the dev simulator URL (`lib/stripe.ts:106`) ❓ (§25). No disconnect or Stripe-dashboard link.

### 10.27 Screen: Settings › Billing
- **Route:** `/app/[v]/settings/billing` · **Screenshots:** paid plan, trial
- Optional green banner (dev) "You're now on the {Plan} plan." · Card "Your plan", "Every plan starts with a 30-day free trial — no card needed." · "Current plan: [badge]" + "Trial ends {date}." (trial only) · 3 plan cards (current = indigo 2px border, disabled "Current plan" button; others "Choose {Plan}").
- ⚠️ Plan features listed here contradict the landing page (§18). No invoices, payment method, cancel, downgrade warning (what happens to spaces above the new limit?), or trial-expired state (nothing enforces trial expiry ❓).
- 🐞/❓ In live Stripe mode the webhook never updates `planTier` after subscription checkout (`api/webhooks/stripe/route.ts:368-381` only stores the subscription id), so the badge would stay "Free trial". Engineering must confirm before designing post-purchase states.

### 10.28 Screen: Settings › Team
- **Route:** `/app/[v]/settings/team` · **Screenshot:** settings-team
- Card "Team members", "Who can sign in and what they can do.": a list of name (or email) + email + role badge (Owner indigo / Manager sky / Staff grey). Card "Invite someone", "They'll sign in with a magic link sent to their email — no password to set up.": Email + Role (Staff default / Manager / Owner) + **Invite** → "Member added. They can sign in with a magic link sent to their email — no password needed." ⚠️ **No invitation email is sent**; the owner must tell the person. Then a "What each role can do" explainer (Owner / Manager / Staff).
- **Missing:** remove member, change role (re-invite with a different role silently changes it), pending/accepted status, "you" marker, last-owner protection.

### 10.29 Screen: Super-admin
- **Route:** `/admin` · **Super-admin only** (others 404) · **Screenshots:** light, dark, mobile, after impersonation
- Header "Venuora admin" / "Platform overview" + "← Back to app". **4 stat cards:** Venues, MRR (computed from plan tier list prices, not Stripe), Bookings (30d), Payment volume (30d). **Venues table:** Venue (+/slug) · Plan (badge, raw "TRIAL"/"GROWTH") · Spaces · Bookings · Clients · Stripe ("✓ enabled" / "—") · Public ("✓ live" / "draft") · **Impersonate →** (title tooltip "Opens the venue dashboard as super-admin (audit-logged)"). **Recent impersonations (audit log):** "email → venue" + "YYYY-MM-DD HH:MM UTC" (⚠️ raw ISO; also duplicate rows, because each page view logs twice). Empty: "None yet."
- 🐞 **Dark mode:** the page sets no background, so in OS dark mode the H1 (zinc-900) sits on the near-black body and is effectively invisible. The cards stay white, but table cells without an explicit colour inherit the light dark-mode foreground (#ededed), so **the Spaces/Bookings/Clients counts and audit-log entries become invisible white-on-white** (screenshot 124).
- **Missing:** search, sort, pagination (all venues load at once), venue status actions.
- **Must survive:** the stats, the venue table columns, impersonation with the audit trail, the audit log.

### 10.30 Screen: Public venue page
- **Route:** `/v/[slug]?month=` · **Everyone; published only** · **Screenshots:** 004 (desktop), 012 (mobile), 025 (next-month availability)
- **Purpose:** win the booking. **Primary goal:** check availability and start booking. **Secondary:** book a tour, read policies, get directions.
- **Header:** 6px brand bar; white bar with logo (if set) + venue name; "Check availability" brand button (hidden on mobile ⚠️, where the hero CTA is the only one).
- **Main, in order:**
  1. H1 venue name; 📍 City, Region.
  2. **Gallery:** desktop = 1 large + 4 small tiles (gradient placeholders when photos are missing, e.g. a pink empty tile in 004); mobile = first photo only. No lightbox ⚠️.
  3. Description (pre-line).
  4. CTAs: **Check availability & book** (brand) · **Book a tour** (outline).
  5. **Spaces:** 2-column cards: photo, name, badge (⚡ "Instant booking" green / "Request to book" sky), "N seated · N standing", "N m²", description (3-line clamp), amenity chips, "Layouts: Banquet (300) · Theatre (450)…", "from **$X**" (lowest of hourly×min, half-day, full-day, evening) or "Pricing on request", **Book this space** → wizard with the space preselected (⚠️ the wizard ignores it until step 2).
  6. **Availability:** "Across all spaces. Pick a date in the booking flow to see exact times." Month grid: Free (green), Partly booked (amber), Fully booked (rose, strikethrough, not clickable; full = every active space blocked across 08:00–22:00), past days greyed. Clickable days → wizard with the date. ‹ › month navigation (current month to +18).
  7. **Reviews:** a dashed placeholder "Reviews coming soon — this venue recently joined Venuora." ⚠️ (❓ keep or remove).
  8. **Location:** address lines + **Get directions** (Google Maps, new tab). Hidden without an address.
  9. **House rules & policies:** house rules + PolicySummary (Payments bullets, Cancellations bullets).
- **Footer:** "Powered by Venuora".
- 🔒 Free/busy only. Never names or details of other bookings.
- ⚠️ Venue phone and email are **not shown** on the venue page (only on `/b` and `/q`). No social or share meta image. Colour-only availability states (the legend helps; strikethrough only on full days).
- **Mobile:** single column; availability cells are square (~45px). Fine.

### 10.31 Screen: Booking wizard (public)
- **Route:** `/v/[slug]/book?space=&date=` · **Screenshots:** step 1 (desktop, mobile), validation, step 2, step 3, step 4 (error, filled), step 5 (instant, request-to-book), inquiry success
- **Header:** brand bar, venue name, "← Back to venue". H1 "Book {Venue}", "Check live availability, see transparent pricing and secure your date."
- **Stepper:** 1 Date & time · 2 Space · 3 Add-ons · 4 Your details · 5 Review & pay (numbers only on mobile; the active colour is indigo, **not the venue brand colour** ⚠️).
- **Steps:** see §9 J6/J7 and §11 F24 for fields and errors.
- **Terminal states:** *Redirecting* ("Taking you to secure payment… held for 15 minutes"), *Inquiry sent* ("Request sent!" + View my booking), *Conflict* ("That slot was just booked" + alternative spaces and dates as **non-interactive** badges + "Choose another date or space").
- **Error placement:** one rose alert above the active panel.
- **Loading:** spinner in the "Check availability" button; small spinner by the running total.
- ⚠️ State is lost on refresh. Times show as raw "10:00–14:00" in step 2 and step 5 headers but as "h:mm a" elsewhere. "Review & pay" is the step label even for request-to-book. Instant-book and request-to-book spaces are mixed in one list with no explanation of the difference until step 5. The date input is a native picker with no availability hints (the venue page calendar has them, but the wizard doesn't).
- **Must survive:** server-side live pricing at every step, availability per space with busy times, capacity warnings, add-on steppers, the terms checkbox with a policy link, the deposit/balance/security breakdown, the cancellation policy, distinct CTAs per booking mode, conflict alternatives, the 15-minute hold message.

### 10.32 Screen: Book a tour (public)
- **Route:** `/v/[slug]/tour` · **Screenshots:** desktop, mobile, past-date error, success
- H1 "Book a 30-minute viewing", "Come and see {Venue} before you commit — pick a time that suits you and the team will confirm." Form card (§11 F25) with a brand-coloured **Request this tour**. Success card: "Tour requested! The venue team will confirm your viewing by email shortly. See you there." + "Back to the venue page".
- ⚠️ No availability: any date and slot can be requested, including days the venue is fully booked or closed (operating hours exist in the schema but have no UI ❓).

### 10.33 Off-app surface: Transactional emails
- **File:** `src/lib/email-templates.ts` (not screenshotted; HTML strings). All share a layout: grey canvas; a 560px card; a **header in solid brand colour with the logo or the venue name in white**; white body; footer "Venue · phone · email". Buttons are brand-colour pills.
- **Templates (to client unless noted):** (1) Inquiry received; (2) Quote ready (+ "View quote — Accept & pay deposit"); (3) Deposit received — "You're booked!" ✨; (4) Balance reminder (+ "Pay balance now"); (5) Event-week logistics (access time incl. setup, house rules, contact); (6) Thank-you (+ security-deposit notice); (7) Security deposit refund (itemised deductions); (8) Booking cancelled (refund tier); (9) Payment failed (**defined but never sent**); (10) **New tour request → owner**; (11) Tour confirmed. Plus (12) the **Auth.js magic-link email** (Auth.js/Resend default design, *not* branded).
- **Booking table rows:** Space, Date & time, Event (⚠️ rendered lower-case from the enum, e.g. "church program"), Guests, Total, Refundable security deposit, Balance due by.
- ⚠️ No email to the owner for new online inquiries or bookings, cancellations by clients, or payments received. Light brand colours make white header text unreadable.

### 10.34 Screen: Manage my booking (client)
- **Route:** `/b/[token]?paid=1|confirmed=1|pay=balance` · **Anyone with the link** · **Screenshots:** confirmed (desktop, mobile), paid banner, cancel dialog, cancelled, completed, penciled, inquiry, 404 bad token
- **Header:** BrandedHeader (§8.6). **Banners:** green "Deposit received — booking confirmed!" / "Payment received — thank you!" (driven only by the URL param ⚠️, so it shows even if the webhook hasn't landed); amber HOLD "Complete your payment within 15 minutes… the hold expires at 3:42 PM. If it lapses, the slot is released to other clients." (🐞 with no pay button); rose "This booking was cancelled on … — reason."
- **Sections:** (1) "{Event} at {Venue}" + status badge; a definition grid: Space, Booked by, Starts, Ends, Guests, Booking type; "All times shown in the venue's local time. Access opens N minutes before your start time for setup." (2) Price breakdown + a summary box: Paid so far; Balance due by {date} (bold when > 0); Refundable security deposit (held / collected with balance). (3) Payment history (excludes pending): type, date · status · reason, amount ("−" for refunds). (4) **Manage this booking**: [Pay balance — $X (incl. security deposit)] (CONFIRMED with an amount due) · [Cancel booking] (INQUIRY, QUOTE_SENT, HOLD, PENCILED or CONFIRMED, and the event is in the future). (5) Cancellation policy sentences. (6) "Questions? Contact {Venue} on {phone} or at {email}."
- **Status badge labels shown to clients** use internal vocabulary: "Penciled", "Checkout hold", "Quote sent", "Inquiry" ⚠️ (§18).
- 🐞 PENCILED or HOLD clients have no way to pay the deposit here. 🔒 Cancel shows a refund preview before confirming.
- ⚠️ No "add to calendar", no directions or address, no edit request, no contact link (plain text only).

### 10.35 Screen: Quote (client)
- **Route:** `/q/[token]` · **Screenshots:** desktop, mobile
- BrandedHeader; H1 "Quote #N" + "Prepared for {Client} by {Venue}". **Banners:** green "Accepted on {date}" + "Go to my booking"; amber "This quote expired on {date}. Contact {Venue} at {email} for a fresh one."; rose "This booking is no longer active. Contact {Venue} if you'd like to rebook." **Event summary:** "{Event} — {Space}"; Starts, Ends, Guests, Quote valid until. **Price:** breakdown + "Deposit due to confirm **$X**" (brand colour), "Balance due by … $Y", "Plus a refundable security deposit of $Z, collected with the balance." **Terms** (the venue's house rules at send time). **CTA** (open quotes only): "Accept & pay $X deposit" (large brand button) + "Paying the deposit confirms your booking and locks the date." Inline error above the button.
- ⚠️ No download/print or "decline" option, and no venue contact block (unlike `/b`). Once accepted, the CTA vanishes even if payment never completed.

### 10.36 System screens: 404, error, auth error
- **404:** Next.js default ("404 | This page could not be found.", black on white, no branding, no navigation). It is reached by: unknown or unpublished venue slug; invalid `/b` or `/q` token; a booking/client/space id from another venue; **insufficient role** (Staff and Managers hitting owner/manager pages); the broken **Add-ons** nav link; non-admins visiting `/admin`. Screenshots: unknown venue, unpublished venue, bad token, add-ons link, manager settings, manager onboarding, staff booking detail, staff spaces.
- 🔒/⚠️ Design **at least three distinct messages**, even though the code currently produces one 404: "This page doesn't exist", "You don't have access to this (ask your venue owner)", and "This venue isn't published yet". Today they're indistinguishable. Distinguishing them needs small engineering changes.
- **Server error:** Next.js default error overlay/page. No branded error. Not screenshotted (no reliable trigger).
- **Auth.js error page:** shown for expired or used magic links. Unstyled. Not screenshotted.
- **Loading:** no route-level loading UI anywhere. Slow navigations show the previous page frozen. Calendar and Bookings are the heaviest.

---

## 11. Forms Inventory

**Global form behaviour (applies to every form unless noted):**
- Validation happens **server-side with zod** (`src/lib/validators.ts`). The server returns **only the first error as a single string**, shown in one rose box at the top of the form (or dialog). **No field is ever highlighted, and errors are not tied to inputs** (`aria-describedby` is unused). Several messages are raw zod output (e.g. "Too small: expected number to be >=1") ⚠️.
- A few forms add **client-side checks** first (noted below). HTML `required`/`min`/`max` attributes are present on some inputs, so the browser's native tooltip validation sometimes fires before custom validation.
- Success = a green inline box ("Saved." etc.) and/or a redirect. **There are no toasts anywhere in the product.**
- There is no "unsaved changes" warning anywhere.
- Money inputs are typed in **dollars** with a hard-coded "$" prefix (⚠️ even though `Venue.currency` exists; it is always "usd" today) and converted to integer cents.
- Required fields are **never visually marked** (no asterisks). Optional fields are marked "(optional)" in some forms only.

### F1. Magic-link sign-in — `/login`
| Field | Type | Req | Default | Placeholder | Validation / errors |
|---|---|---|---|---|---|
| Email | email | ✓ (HTML) | — | you@yourvenue.com | Must contain "@" → "Enter a valid email"; send failure → "Could not send the magic link" |
Submit "Email me a sign-in link" → `/login/check-email`. Cancel: n/a.

### F2. Password sign-in — `/login`
| Field | Type | Req | Default | Placeholder | Validation / errors |
|---|---|---|---|---|---|
| Email | email | ✓ | — | you@yourvenue.com | |
| Password | password | ✓ | — | — | Wrong pair → "Invalid email or password" |
Submit "Sign in" → `/app`.

### F3. Register — `/register`
| Field | Type | Req | Validation |
|---|---|---|---|
| Your name | text | ✓ | 1–120 characters |
| Email | email | ✓ | valid email, lower-cased; exists with password → "An account with this email already exists — sign in instead." |
| Password | password | ✓ | 8–200 characters (helper "At least 8 characters.") |
Submit "Start free trial" → auto sign-in → `/app`. Failure after creation → "Sign-in failed after registration".

### F4. Create venue — `/app/new`
| Field | Type | Req | Validation |
|---|---|---|---|
| Venue name | text | ✓ | 2–120 → "Give your venue a name" |
| Timezone | select (26) | ✓ | default America/New_York |
Submit "Create venue" ("Creating…") → `/app/[slug]/onboarding`. Side effects: slug generated (immutable); creator becomes OWNER; trial ends in 30 days.

### F5. Venue details (General) — `/settings` and onboarding step 1
| Field | Type | Req | Validation |
|---|---|---|---|
| Venue name | text | ✓ | 2–120 |
| Timezone | select (19 + current) | ✓ | — |
| Contact email | email | — | valid email or blank |
| Phone | text | — | ≤30 |
| Street address | text | — | ≤200 |
| City / State-Region / Postal code | text | — | ≤100 / ≤100 / ≤20 |
| Country (2-letter code) | text (maxLength 2, uppercase style) | — | ≤2, default "US" |
| Description (shown on your public page) | textarea | — | ≤2000 |
Submit "Save details" → "Venue details saved." Destructive consequences: a timezone change shifts how every time is displayed. Changing the email changes the reply-to on all client emails.

### F6. Policies — `/settings/policies`
| Field | Type | Default (new venue) | Validation |
|---|---|---|---|
| Deposit | number + "%" suffix | 30 | int 0–100 |
| Balance due | number + "days before" suffix | 14 | int 0–365 |
| Security deposit | number + "$" prefix | 0 | 0–$1,000,000 |
| Auto-charge vs reminders | checkbox card (label toggles) | off | ⚠️ no effect |
| Tax rate | number + "%" (step 0.01) | 0 | 0–30% (stored as basis points) |
| House rules | textarea | — | ≤4000 |
| Cancellation tiers | repeater: days (0–730) + refund % (0–100), 1–6 rows; delete disabled on the last row | 60+→100%, 30+→50%, 0+→0% | client: must contain a 0-day row |
Submit "Save policies" → "Policies saved."

### F7. Branding — `/settings/branding`
| Field | Type | Default | Validation |
|---|---|---|---|
| Brand color | 8 swatches + `<input type=color>` + hex text | default #4f46e5 | regex `#RRGGBB` (live inline error; Save disabled) |
| Logo URL | text | — | valid URL or blank ("Invalid URL") |
| Venue photos | URL repeater (+ Add photo URL, 🗑) | [] | each a valid URL, max 20; blanks dropped |
Submit "Save branding" → "Branding saved."

### F8. Invite team member — `/settings/team`
| Field | Type | Req / default | Validation |
|---|---|---|---|
| Email | email | ✓ | "Enter a valid email address" |
| Role | select Staff / Manager / Owner | Staff | "Pick a role" |
Submit "Invite" ("Inviting…") → "Member added…" + the form resets. Re-inviting an existing member **silently changes their role** ⚠️.

### F9. Choose plan — `/settings/billing` (one form per plan card)
Button "Choose Solo/Growth/Pro" → Stripe Checkout (subscription with a 30-day trial) or dev instant switch. The current plan's button is disabled ("Current plan").

### F10. Connect Stripe — `/settings/payments`, onboarding step 6
Button "Connect Stripe" / "Resume onboarding" / "Resume Stripe onboarding" → Stripe-hosted onboarding.

### F11. Publish venue — onboarding step 7
Button "Publish my venue page" ("Publishing…"); error "Add at least one space before publishing"; success panel with Copy. **Irreversible in the UI** (no unpublish).

### F12. Space form — `/spaces/new`, `/spaces/[id]`
| Field | Type | Req | Default | Validation |
|---|---|---|---|---|
| Space name | text | ✓ | — (placeholder "e.g. Main Hall") | 1–120 |
| Description (shown to clients) | textarea | — | — | ≤2000 |
| Seated capacity | number | — | 0 | int 0–100,000 |
| Standing capacity | number | — | 0 | int 0–100,000 |
| Floor area (m²) — optional | number | — | blank | 0–1,000,000 |
| Amenities | 12 suggestion checkboxes (3-col grid) + custom chips (× remove) + "Add your own" text + Add (Enter also adds) | — | [] | each 1–60, max 40 |
| Layouts | repeater: name + capacity + 🗑; "+ Add layout" | — | [] | name 1–60, max 10; blank names dropped |
| Photos (paste image URLs) | URL repeater | — | [] | valid URLs, max 20 |
| Calendar color | 8 swatches (Indigo, Sky, Emerald, Amber, Rose, Violet, Teal, Slate) | ✓ | Indigo | hex |
| Setup buffer (minutes before) | number | — | 60 | 0–1440; helper "Time you block before each event for setup — clients get access from then." |
| Teardown buffer (minutes after) | number | — | 60 | 0–1440 |
| Instant book | checkbox card | — | off | helper "Instant book lets clients pay online without approval; otherwise you approve inquiries first." |
Submit "Create space" / "Save space". Plan-limit error on create. Buffers and Instant book affect **new** bookings only (snapshotted) 🔒.

### F13. Rate plan — `/spaces/[id]`
| Field | Type | Default | Validation |
|---|---|---|---|
| Hourly rate | $ number | blank | client: > 0 → "Enter an hourly rate — it's the base for all pricing." |
| Minimum hours per booking | number | 2 | 1–24 |
| Overtime rate (per extra hour) | $ number | blank = "Same as hourly" | ≥0 |
| Half-day package | checkbox "offered" → Price $ + Included hours | off, 5h | hours 1–12 |
| Full-day package | same | off, 12h | hours 1–24 |
| Evening package | same | off, 6h | hours 1–12 |
| Evening package starts from (hour, 0–23) | number (shown only when evening is offered) | 17 | ⚠️ stored, not used by pricing |
| Day-of-week pricing ×7 | select Standard / +10% / +25% / +50% / Custom… (+ % input 25–500) | Sun–Thu 100, Fri–Sat 125 | |
| Peak periods | repeater: name, From (date), To (date), Multiplier % (25–500), 🗑; "+ Add peak period" (default 125%) | [] | max 20; rows missing a name or date are **silently dropped** ⚠️; no check that From ≤ To ⚠️ |
Submit "Save rates" → "Rates saved." Note: "If a date falls in two periods, the higher one applies." Changes affect new bookings only 🔒.

### F14. Add-on dialog — `/addons`
| Field | Type | Req / default | Validation |
|---|---|---|---|
| Name | text | ✓ (server) | 1–120 |
| Description (optional) | textarea | — | ≤500 |
| Price | $ number | — | ≥0 (blank becomes $0 ⚠️) |
| Charged | select Flat fee (once) / Per unit | Flat | |
| Max quantity | number (disabled for Flat; "No limit") | blank | 1–10,000 |
| Active — clients can select this add-on | checkbox | on | |
Buttons: [Remove] (edit only; native confirm; soft-delete) · [Close] · [Save add-on].

### F15. Client edit — `/clients/[id]`
| Field | Type | Req | Validation |
|---|---|---|---|
| Name | text | ✓ | "Name is required", ≤120 |
| Phone | text | — | ≤30 |
| Email | email | — | valid or blank |
| Organization | text | — | ≤160 |
| Notes (only your team sees these) | textarea | — | ≤2000 |
Submit "Save changes" → "Saved."

### F16 / F17. Search — Bookings (`q`, plus hidden `status`) and Clients (`q`)
GET forms. Submit by button or Enter. No clear-search control, no live search, no result count.

### F18. Fast phone booking — calendar dialog
| Field | Type | Req | Default | Validation |
|---|---|---|---|---|
| Client name | text (autofocus) | ✓ | — ("Ada Okafor") | client "Enter the caller's name"; ≤120 |
| Phone | tel | ✓ | — ("+1 555 010 2030") | client ≥5 → "Enter a phone number"; server 5–30 |
| Email (optional) | email | — | — | valid or blank |
| Space | select (active spaces) | ✓ | prefill or first | "Pick a space"; the space must have rates → "Set up rates for this space first" |
| Event type | select (Wedding, Birthday, Conference, Church program, Corporate, Other) | ✓ | Other | |
| Slot | select (Hourly, Half-day package, Full-day package, Evening package) | ✓ | Hourly | a package not configured → "Space has no FULL_DAY package configured" |
| Date | date | ✓ | prefill | YYYY-MM-DD; ⚠️ past dates are **allowed** |
| Start / End | time (15-min step) | ✓ | 18:00 / 22:00 or prefill | HH:MM |
| Ends next day | checkbox | — | prefill/false | also inferred when end ≤ start |
| Guest count | number | — | 50 | 0–100,000 |
| Notes | textarea (1 row) | — | — | ≤2000 |
| Pencil days | number (next to the Pencil button) | — | 5 | clamped 1–30 |
Submit = one of four buttons (INQUIRY / QUOTE / PENCIL / CONFIRM). The pending label changes per button ("Saving…", "Sending…", "Holding…", "Confirming…"). Conflict → alternatives as clickable chips. Success: closes the dialog, or shows the deposit-link panel for CONFIRM.

### F19. Move booking — calendar booking dialog
Space (select), Date, Ends next day, Start, End (15-min step). [Preview move] → [Confirm move]. Errors: pricing errors, "That slot is taken." + free spaces.

### F20. Pencil hold — booking detail dialog
"Hold for how many days?" number 1–30 (default 5; invalid → 5) · [Close] [Place hold]. Result is shown as a notice on the page after closing.

### F21. Record manual payment — booking detail dialog
| Field | Type | Default / helper |
|---|---|---|
| What is this payment for? | select Deposit / Balance / Security deposit | Deposit |
| Amount | $ number, step 0.01, min 0.01 | blank; helper "Outstanding balance: $X" |
Errors: "Enter a valid amount in dollars, e.g. 250.00"; "Payment recorded, but the slot is blocked by another booking!". Success notice: "Recorded $X — thank you." ⚠️ The amount is not prefilled and there is no warning on overpayment. 🔒 A Deposit **confirms** the booking.

### F22. Cancel booking (owner) — booking detail dialog
Reason (shared with the client) textarea, placeholder "e.g. Client requested to cancel" (blank → "Cancelled by venue"). [Keep booking] [Cancel booking (red)]. Irreversible: refunds per policy plus the full security deposit, emails the client, frees the slot. The result view shows the amounts.

### F23. Settle security deposit — booking detail dialog
Repeater: Reason ("e.g. Broken chair") + $ amount + 🗑; "+ Add deduction". Live summary "Will refund $X of $Y held (keeping $Z)." Blank rows are dropped; blank reasons become "Deduction". Max 20; capped at the held amount. [Close] [Refund & settle]. Irreversible; emails the client the itemised list.

### F24. Public booking wizard — `/v/[slug]/book`
| Step | Field | Type | Req | Default | Validation / message |
|---|---|---|---|---|---|
| 1 | Date | date | ✓ | `?date=` or blank | "Pick a date for your event."; server "That date is in the past." |
| 1 | Booking type | select (4) | ✓ | Hourly | changing it resets start and end to defaults (Hourly 10–14, Half-day 9–14, Full-day 9–21, Evening 18–23) |
| 1 | Start time / End time | time (15-min) | ✓ | per type | "End time must be after the start time (or tick "ends next day")." |
| 1 | Ends the next day (past midnight) | checkbox | — | off | |
| 1 | Guest count | number | ✓ | 50 | ≥1 → "How many guests are you expecting?" |
| 1 | Event type | select (6) | ✓ | Other | |
| 2 | Space | card choice (**Choose**) | ✓ | `?space=` is not preselected visibly | disabled when unavailable or not offered |
| 3 | Add-ons | toggle (flat) / stepper 0–max (per unit; default max 99) | — | 0 | |
| 4 | Full name | text | ✓ | — | client: "Please fill in your name and a valid email." |
| 4 | Email | email | ✓ | — | client: contains "@"; server email |
| 4 | Phone | tel | — (not labelled optional ⚠️) | — | 5–30 if given |
| 4 | Notes for the venue (optional) | textarea | — | — | ≤2000 |
| 4 | I agree to the venue's house rules & policies | checkbox | ✓ | off | "Please accept the venue's house rules and policies to continue." |
| 5 | (review) | — | — | — | submit: "Pay $X deposit" / "Send booking request" |

### F25. Tour request — `/v/[slug]/tour`
| Field | Type | Req | Validation |
|---|---|---|---|
| Full name | text | ✓ | |
| Email | email | ✓ | |
| Phone (optional) | tel | — | ≤30 |
| Space to view (optional) | select: Whole venue + spaces | — | |
| Preferred date | date | ✓ | future → "Pick a future time" |
| Preferred time | select 9:00 AM–6:30 PM, 30-min | ✓ | default 10:00 |
| Notes (optional) | textarea | — | ≤1000 |
Submit "Request this tour" → success card.

### F26. Client cancel — `/b/[token]` dialog
Refund preview (auto-loaded) · Reason (optional) · [Keep booking] [Cancel booking]. Errors: "Booking not found", "Already cancelled", "This event has already started", "Could not load your refund preview — please try again."

### F27. Accept quote — `/q/[token]`: one button, with errors above it.
### F28. Pay balance — `/b/[token]`: one button → Stripe. Errors: "Nothing left to pay", "Could not start the payment — please try again."
### F29. Venue switcher — sidebar `<select>` (≥2 venues), navigates on change.
### F30. Inline action forms on the dashboard — Setup toggle, Teardown toggle, Send payment link, Confirm tour, Decline tour (each a one-button server form, no confirmation, no feedback text).
### F31. Sign out — sidebar button (form). No confirmation.

**Form count:** 23 data-entry forms (F1–F8, F12–F26) + 8 single-action forms (F9–F11, F27–F31) = **31**.

---

## 12. Components Inventory

### 12.1 Formal UI kit (`src/components/ui/`)

| Component | Variants / sizes | States | Where | Inconsistencies | Design-system? |
|---|---|---|---|---|---|
| **Button** (`button.tsx`) | default (indigo), secondary (zinc-100), outline, ghost, destructive (rose), success (emerald) × default h-10 / sm h-8 / lg h-12 / icon 36px | hover, focus-visible outline, disabled (50% opacity) | Owner app, dialogs, wizard back/add-on buttons | **Bypassed** on ~30 places with hand-written classes: landing CTAs, SubmitButton, BrandButton, dashboard mini-buttons (`h-auto px-2.5 py-1 text-xs`), the tour pending buttons, bookings pills, the client pay button. Text labels vary between "Close", "Keep booking" and "Done" for dismiss | ✅ core |
| **Input / Textarea / Select / Label** (`input.tsx`) | single size (h-10) | focus outline, disabled; **no error state, no help-text slot, no prefix/suffix slot** (the $ and % adornments are hand-positioned spans) | everywhere | Checkboxes are raw `<input type=checkbox>` with `accent-indigo-600` (4 different layouts); no Radio, Switch or Checkbox component | ✅ core, extend |
| **Card** + Header/Title/Description/Content/Footer | one style (rounded-xl, border, shadow-sm) | hover shadow on link cards | owner app, auth | Public pages use their own `rounded-2xl` "Panel" style; the landing uses `rounded-2xl`; admin uses Card. CardFooter is unused | ✅ |
| **Badge** / **StatusBadge** | free-form colour via className; StatusBadge maps 9 booking statuses | — | everywhere | Tour, role, plan, add-on, space, payment-status colours are defined ad hoc in 5 files; payment status is coloured **text**, not a badge | ✅ |
| **Dialog** (+Title, Description) | max-w-lg default; md/xl overrides | native `<dialog>` modal: Esc + backdrop close, focus moves in (browser) | 9 dialogs | No close (×) icon. Footer button order/alignment varies (right-aligned vs full-width vs between). Results are shown *inside* the same dialog in some cases and as page notices in others | ✅ |

### 12.2 Shared feature components

| Component | File | Purpose | Notes |
|---|---|---|---|
| ActionForm + SubmitButton | `components/public/action-form.tsx` | auth forms with pending state + error alert | Only one with `role="alert"` on errors |
| BrandedHeader / PoweredByFooter | `components/public/branded-header.tsx` | token pages header/footer | Not used on `/v/*` (three header variants) |
| PhotoOrPlaceholder, photoList | `components/public/photo.tsx` | image or 5 rotating pastel gradients | the owner Spaces grid has its own placeholder |
| PolicySummary, cancellationSentences | `components/public/policy-summary.tsx` | plain-language policy text | Reusable for an owner-side preview |
| PriceBreakdown | `components/public/price-breakdown.tsx` | line items + subtotal/tax/total | The owner booking detail re-implements it as a 4-column table |
| AppSidebar (NavLinks, VenueSwitcher, ShellInner) | `components/app-shell/sidebar.tsx` | shell | |
| SettingsNav | `settings/settings-nav.tsx` | tab pills | |

### 12.3 Route-local components (patterns the system must absorb)

StatTile, ChecklistToggle (dashboard) · PublishButton (onboarding) · CalendarView: MonthGrid, Timeline, BookingBar, Legend · NewBookingDialog, BookingDialog · BookingActions (owner) · CopyButton · ClientEditForm · TourButtons, TourRow · DeactivateSpaceButton · SpaceForm, RatePlanForm (renderPackage) · AddOnsManager · GeneralForm, PoliciesForm, BrandingForm, InviteForm · DevOnboardedHandler (invisible) · BookingWizard: Stepper, Panel, BrandButton, BackLink · AvailabilityCalendar, LegendDot · client BookingActions · AcceptQuoteButton · TourForm · `Item`/`Row` definition-list helpers (duplicated in `/b` and `/q`).

### 12.4 Implicit UI patterns with no component (each re-implemented)

| Pattern | Occurrences | Notes |
|---|---|---|
| **Inline alert / notice box** (rose error, emerald success, amber warning, indigo info) | ~40 | At least 4 different paddings and radii; only some have icons; only 3 have `role="alert"` |
| **Data table** | bookings, clients, add-ons, admin venues, booking price, booking payments | Header style mostly consistent (uppercase xs zinc-500); 2 have mobile card fallbacks, 4 don't |
| **Empty state** | ~20 | All plain grey text in a card; 2 have a CTA button; none have an illustration or icon |
| **Page header** (title + description + actions) | every page | 2 sizes (`text-2xl` / `text-xl`) |
| **Back link** ("← All …") | 4 | |
| **Pill tabs / segmented control** | bookings status, settings nav, calendar views | 3 different styles |
| **Search bar** (input + button) | 2 | |
| **Currency input** ($ prefix) / **percent input** (% suffix) / **unit suffix** ("days before") | ~12 | hand-positioned spans |
| **Repeater rows** (add/remove) | layouts, photos (×2), peak periods, cancellation tiers, deductions | 5 slightly different layouts |
| **Checkbox card** (bordered label with title + help) | instant book, auto-charge | |
| **Swatch picker** | space colour, brand colour | different sizes and selection styles |
| **Copy-link field** | 4 (deposit link, balance link, manage link, published URL) | 3 implementations |
| **Quantity stepper** | wizard add-ons | |
| **Stepper / progress** | wizard steps, onboarding progress bar | |
| **Status legend** | calendar, public availability | |
| **Link-styled card rows** | dashboard inquiries, client history, venue picker | |
| **Banner (full-width)** | impersonation, setup incomplete | |
| **Slide-over drawer** | mobile nav | |
| **Spinner** | `Loader2 animate-spin` | inconsistent: some buttons change text ("Saving…"), some add a spinner, some both |

**Count:** 5 kit families (11 exported pieces) + 7 shared components + ~30 route-local components + 19 implicit patterns. Roughly **45 distinct reusable components/patterns** should end up in the design system.

---

## 13. UI State Inventory

| State | Where it exists today | Notes for design |
|---|---|---|
| **Default** | all screens | |
| **Hover** | links, buttons, table rows (zinc-50), cards (shadow), calendar cells (indigo-50/40), availability days (scale 105%) | no hover on stat tiles (not interactive) |
| **Focus** | Button/Input/Select/Textarea have a `focus-visible` indigo outline; calendar bars have a ring | ⚠️ raw `<button>`s (dashboard pills, wizard BrandButton, tour/quote/pay brand buttons, color swatches, availability links, sidebar links) have **no custom focus style** and rely on the browser default |
| **Active / selected** | sidebar item (indigo-50), calendar view toggle, bookings tab, settings tab, swatches (ring + check), stepper current, add-on "Added" | |
| **Disabled** | buttons while pending (opacity 50–60%); "Choose" on unavailable spaces; Max qty for flat add-ons; settle button when nothing is held; delete tier when only 1; Save branding with an invalid hex | no explanation shown next to most disabled controls |
| **Loading / pending** | button text swap ("Saving…", "Checking…", "Moving…", "Holding…", "Creating…", "Publishing…", "Inviting…", "Cancelling…", "Settling…", "Working…") and/or spinner; wizard running-total spinner; cancel-preview loader | **no page-level loading or skeletons anywhere**; no `loading.tsx` |
| **Saving / success** | green inline text ("Saved.", "Space saved.", "Rates saved.", "Policies saved.", "Branding saved.", "Venue details saved.", "Quote sent…", "Penciled in…", "Recorded $X — thank you.", "Marked as a no-show.", "Member added…") | no toasts; success messages persist until the next action; some silent (dashboard actions, Log inquiry) |
| **Warning** | amber: outstanding balance, hold expiry, "may be tight for N guests", Stripe onboarding unfinished, "No rates set yet", "Not published yet", price-change preview, quote expired, HOLD banner, impersonation | |
| **Error** | rose boxes (forms), rose status badges, framework 404/500 | §11 global behaviour |
| **Empty** | dashboard ×3, calendar (no spaces), bookings, clients, client history, payments, tours ×3, spaces, add-ons, admin audit log, venue page spaces, wizard spaces, wizard add-ons | see screenshots "empty-*" |
| **Partially populated** | onboarding (k of 7), venue page with some photos (gradient fills), space without rates, spaces without packages ("Not offered for this booking type") | |
| **Fully populated / dense** | calendar "+N more", bookings 200 cap, clients 300 cap | §10 data density |
| **Permission denied** | **only as a framework 404** | needs a real screen (§10.36) |
| **Offline / network failure** | client components catch errors → "Something went wrong — try again." / "Could not check availability…" | server-rendered pages: framework error |
| **Deleted / unavailable** | inactive space (badge; hidden publicly), inactive add-on (badge), cancelled booking (banner), expired hold (status "Expired hold"), expired quote (banner), inactive quote booking (banner), unpublished venue (404) | |
| **Expired** | quote validity, pencil and checkout holds, trial end date (display only), magic link (Auth.js page) | |
| **Long content** | truncation via `truncate` on names in sidebar, cards, chips; `line-clamp-3` on public space descriptions; notes `whitespace-pre-wrap` | the URL code boxes truncate |
| **Large dataset** | no pagination anywhere | §10 |
| **First-time user** | onboarding + "Setup incomplete" banner + empty states | no product tour or tooltips |
| **Returning user** | lands on This week (or picker) | no "since last visit" |
| **Impersonating** | amber banner | |
| **Dev-mode** | "Dev note" on check-email (shown in prod ⚠️), simulated payments, dev banners on billing | remove from production designs |
| **Booking status (9)** | Inquiry · Quote sent · Checkout hold · Penciled · Confirmed · Completed · Cancelled · No-show · Expired hold | each needs a badge, a calendar treatment, a client-facing label and an owner-facing action set |
| **Payment status (4)** | Pending · Succeeded ("Paid" to clients) · Failed · Refunded | |
| **Tour status (5)** | Pending · Confirmed · Declined · Completed · Cancelled | |
| **Venue state** | draft/published, Stripe none/pending/connected, plan Trial/Solo/Growth/Pro, onboarding % | |

### 13.1 Data-density cases (design with realistic extremes, not seed-perfect content)

| Data | Realistic extreme | Where it bites |
|---|---|---|
| Venue name | 120 characters ("St. Michael & All Angels Parish Community Hall and Conference Centre") | sidebar (truncates), branded headers, emails, picker cards, admin table |
| Space name | 120 characters; 10 spaces (Pro) | calendar row labels (128px, truncates), month chips, wizard cards, legend wraps |
| Client name | couples and organisations ("Ifeoma & David Okonkwo-Adebayo", "Rotary Club Midtown Atlanta Chapter") | calendar bars (truncate to nothing on 2h events in week view), dashboard cards, H1 "Client — Space" on detail |
| Descriptions / notes / house rules | 2,000 / 2,000 / 4,000 characters with line breaks | venue page, quote Terms, notes box on detail, event-week email |
| Bookings per day | 3 spaces × 2–3 events (+ inquiries overlapping, which don't block) | month cells ("+N more"), timeline rows (overlapping tentative bars stack on top of each other; no lanes) |
| Total bookings | thousands over the years | bookings list (cap 200, no pagination), client history (uncapped), "All" sorted newest-first |
| Clients | hundreds to thousands | clients list (cap 300), no pagination |
| Add-ons | dozens; per-unit quantities up to 10,000 | wizard step 3 list, line items ("Chiavari chairs × 300"), add-on table |
| Line items | space + overtime + 10 add-ons + tax | price breakdown on mobile |
| Payments per booking | deposit, balance, security, refunds + **many PENDING rows** from repeated link generation | payments table |
| Money | up to $1,000,000 per field; totals in 7 figures; cents shown only when non-zero ("$1,241.62" vs "$1,000") | stat tiles, tables (right-align, tabular numbers), mobile cards |
| Dates/times | cross-midnight events; 18 months ahead; timezones far from the viewer | every date display; always show the venue tz |
| Photos | 0–20 per venue and per space; broken URLs; very wide or tall images; non-image URLs | gallery (no broken-image fallback beyond the browser's), space cards |
| Missing values | no phone, no email, no organisation, no address, no description, no photos, no logo, no rates, no packages | contact rows, location section hidden, "Pricing on request", "Not offered for this booking type" |
| Statuses | all 9 booking statuses in one list or calendar | badges, legend, filters |
| Team | 1–20 members, multiple Owners | team list |
| Admin | every venue on the platform, unpaginated | admin table |
| Amenities | up to 40 chips per space | venue page space cards (no clamp) |
| Peak periods / tiers | 20 peak periods; 6 cancellation tiers | rates form, policy sentences |

---

## 14. Responsive Behaviour

**Breakpoints in use:** Tailwind defaults `sm` 640 · `md` 768 · `lg` 1024. (`xl` and `2xl` are unused, so nothing adapts above 1024px except max-width containers.)

| Area | < 640 (mobile 320–430) | 640–1023 (tablet 768/820) | ≥ 1024 (laptop/desktop 1280–1920) |
|---|---|---|---|
| Owner shell | sticky top bar + hamburger slide-over | **same as mobile** (no sidebar until 1024 ⚠️ wastes space on iPad landscape at 1024) | fixed 256px sidebar; content max-w-6xl (1152px) centred, so lots of empty space at 1920 |
| Dashboard | everything 1 column | stat tiles 3 columns from 640 (cramped at 640–760); events 1 column | events 2 columns |
| Calendar month | 7 columns × ~48px; chips unreadable; toolbar wraps to 3 rows | usable | good |
| Calendar week/day | horizontal scroll inside a card (week ≈ 2,100px wide); the sticky space column eats 128px of a 390px screen | scroll | week still scrolls at 1440 ⚠️ (bars tiny) |
| Bookings / Clients | **cards** (< 768) | table from 768 (8 columns → horizontal scroll at 768–1000) | table |
| Add-ons / Admin / booking detail tables | horizontal scroll, no card fallback | scroll | fits |
| Booking detail | 1 column; Actions card comes after event/price/payments (far down) | 1 column | 2/3 + 1/3 |
| Forms | grids collapse to 1 column; repeater rows can overflow (peak periods use a 2-column grid; deductions row: reason + 112px amount + icon) | 2–3 columns | |
| Dialogs | `w-full max-w-*` with `m-auto`; on phones they become full-width with ~16px margins; scroll inside at 85vh; buttons can wrap (4-exit grid) | | |
| Public venue page | single photo; CTAs stack full-width; header CTA hidden | 2-column spaces from 768 | 5-photo mosaic |
| Wizard | stepper numbers only; space photos hidden (< 640) | labels shown | max-w-3xl |
| Landing | stacks; no nav menu (Pricing link hidden) | 2-column features | 3 columns |

**Sticky elements:** mobile app top bar; the calendar timeline's space-label column (horizontal). Nothing else is sticky. ⚠️ Long forms (space, rates, policies) have their save button at the very bottom with no sticky action bar.

**Touch targets:** many controls are below 44×44px: `sm` buttons (32px), icon buttons (36px), dashboard pills (~26px), calendar chips (~18px), availability "‹ ›" (32px), swatches (32px), the remove "×" on amenity chips (~12px), checkboxes (16px).

**Screens that currently break or become uncomfortable:** calendar month and week on mobile (Critical for an owner on the phone); booking detail on mobile (action priority); add-ons and admin tables on mobile; the fast-booking dialog on mobile (long and scrolling, with 4 small exit buttons); space detail on mobile (very long, two save buttons); tablet 768–1023 (no sidebar, a phone layout stretched).

---

## 15. Existing Visual Language

**There is no coherent design system.** There is a consistent *default* (Tailwind zinc + indigo, Geist, rounded-lg/xl cards), applied by hand in each file with drift.

| Element | Current |
|---|---|
| **Brand name / logo** | Text wordmark only: "Venu" (zinc-900) + "ora" (indigo-600), `font-semibold tracking-tight`. No logo mark, no SVG. |
| **Primary colour** | indigo-600 `#4f46e5` (buttons, active states, links); hover indigo-700; tints indigo-50/100 |
| **Neutrals** | Tailwind zinc scale: zinc-900 text, zinc-500/600 secondary, zinc-400 tertiary, zinc-200/300 borders, zinc-50 page bg |
| **Semantic** | emerald (success/confirmed/paid), rose (error/destructive/cancelled), amber (warning/outstanding/holds), sky (inquiry/info), violet (quote), orange (no-show), yellow (penciled) |
| **Status colours** | `src/lib/labels.ts`: chip classes + bar hex colours for 9 statuses (🔒 the mapping is the source of truth; restyle, but keep the semantics) |
| **Venue brand colour** | user-chosen hex (default `#4f46e5`). Used on client pages for the top bar, buttons, deposit amounts and email headers. In the owner app, only a dot |
| **Space colours** | 8 presets, used on calendar chips, dots and space placeholders |
| **Backgrounds** | white cards on zinc-50; landing alternates white/zinc-50 sections + one zinc-950 band; `globals.css` defines a **dark-mode body** (#0a0a0a / #ededed) that the app never designed for (🐞 §10.29, §10.5) |
| **Typography** | Geist Sans (body), Geist Mono (URLs/codes). Sizes: text-[10px]/[11px] (calendar), xs 12, sm 14 (default UI text), base 16, lg 18, xl 20 (most page titles), 2xl 24 (some titles, public sections), 3xl/4xl (venue H1), 4xl/6xl (landing H1). Weights: medium 500, semibold 600, bold 700 (admin only). Uppercase tracking-wide xs labels for table headers and dashboard section titles |
| **Icons** | lucide-react, 14–20px, mostly zinc-400 or semantic colour |
| **Radius** | md (6px: small buttons), lg (8px: buttons, inputs, alerts), xl (12px: cards, dialogs), 2xl (16px: public panels, landing cards), full (badges, pills) |
| **Shadows** | shadow-sm (cards, buttons), shadow-md (hover, highlighted plan), shadow-xl (dialog, drawer) |
| **Spacing** | Tailwind 4px grid; cards p-5/p-6; section gaps space-y-4 to space-y-8; inconsistent page gutters (§10.7) |
| **Grid** | ad-hoc CSS grid per page; max widths 3xl/4xl/5xl/6xl |
| **Buttons** | §12. Brand-colour buttons on public pages use inline `style` with white text regardless of colour |
| **Forms** | bordered zinc-300 inputs, h-10, labels above (sm medium zinc-700), help text xs zinc-500 |
| **Tables** | uppercase xs header, divider rows, hover zinc-50 |
| **Illustrations** | none |
| **Photography** | user-supplied URLs only (seed uses Unsplash); pastel gradient placeholders |
| **Empty-state visuals** | none (text only) |
| **Animation** | colour transitions, spinner, hover scale on swatches and availability days, `group-hover:translate-x-0.5` arrow on the setup banner, an onboarding progress-bar width transition |
| **Emojis in copy** | ✨ (deposit email subject), 🎉-style PartyPopper icon on publish, ⚠ in system notes, ✓ in admin table |

**Inconsistencies to resolve:** 3 page-title sizes; 2 card radii (xl vs 2xl) between owner and public; 4 alert-box styles; 3 tab styles; buttons bypassing the kit; indigo used as "brand" on venue-branded pages (wizard stepper, links, checkboxes); dark-mode body leak; status colours that collide (amber HOLD vs yellow PENCILED vs amber "outstanding"; emerald for both "Confirmed" and "Instant booking"; sky for both "Inquiry" and "Request to book").

---

## 16. Asset Inventory

| Asset | Location | Status | Keep? |
|---|---|---|---|
| Favicon | `src/app/favicon.ico` | **Default create-next-app icon** (Next/Vercel triangle) | Replace (needs a Venuora mark) |
| `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | `public/` | create-next-app leftovers; **not referenced anywhere** | Delete / ignore |
| Wordmark | text in 4 files (`page.tsx`, `login`, `register`, footer) | CSS text | Needs a real logo |
| Fonts | Geist / Geist Mono (Google via next/font) | in use | designer's choice |
| Icons | lucide-react (~45 icons used: Home, CalendarDays, ClipboardList, Users, Footprints, Sofa, Package, Settings, ExternalLink, LogOut, Menu, X, AlertTriangle, ArrowRight/Left, Eye, BadgeDollarSign, CalendarCheck2, Check, CheckCircle2, CircleDashed, Inbox, Link2, CalendarPlus, ChevronLeft/Right, Copy, Phone, Mail, User, Building2, Plus, Minus, Trash2, Pencil, Search, Clock, Zap, Loader2, MailCheck, PartyPopper, CreditCard, MapPin, Ruler, Star, Globe2, FileText, PhoneCall, ShieldCheck, BadgeCheck, CalendarClock) | in use | yes (or an equivalent set) |
| Venue logos & photos | **external URLs** stored in DB (`Venue.logoUrl`, `Venue.photos`, `Space.photos`) | no upload, no storage | ❓ upload is a backend change |
| Placeholder gradients | `components/public/photo.tsx` (5 pastel gradients) + the space-colour gradient on owner Spaces | in use | redesign |
| Initial-letter logo tile | BrandedHeader & branding preview | in use | keep the concept (fallback logo) |
| Email header/branding | inline HTML in `email-templates.ts` | in use | redesign |
| Social / OG images | **none** (only title + description metadata) | missing | design for venue pages and the landing |
| PDF / invoice / quote documents | **none** (copy mentions "documents" and "invoices") | missing | ❓ |
| Illustrations | none | — | opportunity |

---

## 17. Accessibility Findings (target: WCAG 2.2 AA)

| # | Issue | Where | WCAG | Severity |
|---|---|---|---|---|
| A-1 | **Brand-colour buttons always use white text.** Light venue colours (e.g. amber `#f59e0b` ≈ 2.1:1) fail contrast on CTAs, the deposit amount and email headers | all client pages, emails | 1.4.3 | High |
| A-2 | **Errors aren't associated with fields** (no `aria-invalid`/`aria-describedby`, one message per form, many without `role="alert"`) | all owner forms | 3.3.1, 4.1.3 | High |
| A-3 | **Colour-only meaning**: calendar status dots, space colour, availability day colours (only full days have strikethrough), payment status text colour, tentative = dashed + opacity | calendar, venue page, payments table | 1.4.1 | High |
| A-4 | **Calendar timeline is mouse-centric**: click position chooses the time; drag-and-drop moves; no keyboard path to create at a specific time (the "New booking" button exists) or to move except via the dialog form | calendar | 2.1.1, 2.5.7 (dragging) | High |
| A-5 | Month cells are `div role="button"` that contain other buttons (nested interactive) | calendar month | 4.1.2 | Medium |
| A-6 | **Small text**: 10–11px in the calendar and legend; 12px helper text widely | calendar, forms | 1.4.4 (readability) | Medium |
| A-7 | **Small touch targets** (§14) | many | 2.5.8 | Medium |
| A-8 | **Missing focus styles** on hand-styled buttons and links (§13) | dashboard, public pages | 2.4.7 / 2.4.11 | Medium |
| A-9 | Icon-only controls: most have `aria-label` (good); the amenity "×" has a label; the Search button on mobile is icon-only but has text in the DOM (`hidden sm:inline`, so it is hidden from screen readers too ⚠️) | | 4.1.2 | Low |
| A-10 | Placeholder used as the only hint for the repeater inputs (layout name/capacity, photo URL, deduction reason/amount, peak period name, tier inputs labelled by `aria-label` only) | forms | 3.3.2 | Medium |
| A-11 | **Heading structure**: dashboard section titles are `h2` styled as small caps labels; StatTile uses CardTitle `h3`; settings pages have an H1 in the layout and `h3` card titles (no h2); landing pricing uses `h4` under `h3` | various | 1.3.1 | Low |
| A-12 | Mobile slide-over: no focus trap, no Escape, background not inert | shell | 2.4.3 | Medium |
| A-13 | Native `confirm()`/`prompt()` fallbacks | add-ons, copy | — | Low |
| A-14 | Time-limited hold (15 min) shown as a fixed clock time; no countdown and no extension | `/b` HOLD | 2.2.1 | Medium |
| A-15 | Gallery images: decorative vs informative alt is mixed ("{Venue} — photo 2"); logo `alt=""` (fine as decorative next to the name) | venue page | 1.1.1 | Low |
| A-16 | Dark-mode leak makes the admin H1 invisible | `/admin` | 1.4.3 | Medium |
| A-17 | No reduced-motion handling (minor motion only) | | 2.3.3 | Low |
| A-18 | Language/timezone: times lack a timezone label on client pages ("venue's local time" sentence only) | `/b`, `/q`, wizard | 3.3.2 | Low |

---

## 18. Content & Microcopy Findings

### 18.1 Terminology map (do not silently rename business terms; agree changes with the product owner)

| Concept | Terms used in the product | Notes |
|---|---|---|
| A bookable room | **Space** (everywhere) | consistent ✓ |
| An unconfirmed request | **Inquiry** (owner), "booking request" / "Request sent!" (client), "Request to book" (badge) | OK, but needs a defined client-facing label |
| Owner soft hold | **Penciled** / "Pencil hold" / "Penciled in" / "held until Friday" | jargon for non-industry users ❓ |
| 15-min checkout hold | **"Checkout hold"** (status label), "HOLD", "held for 15 minutes" | clients see "Checkout hold" as a status badge ⚠️ |
| Expired hold | "Expired hold" | |
| Deposit | "Deposit", "Booking deposit" (client history), "deposit link", "Confirm + deposit link" | |
| Security deposit | "Security deposit", "refundable security deposit", "caution fee" (landing), "damage deposit" (policies help) | 4 names ⚠️ |
| Package | "Slot" (phone form label), "Booking type" (wizard, `/b`), "Half-day package" (labels) | 3 names ⚠️ |
| Dashboard | "This week" (nav and H1) | it's really "next 7 days" |
| Client | "Client" (owner), "Booked by" (`/b`), "caller" (phone form), "Prepared for" (quote) | OK |
| Manage page | "Client booking page", "your booking page", "View my booking", "Go to my booking", "manage link" | |
| Viewing | "Tour", "30-minute viewing", "venue tour" | OK |
| Plans | "Free trial" / "TRIAL" (raw in admin), Solo/Growth/Pro | raw enum in admin and on the role badges ("OWNER") |

### 18.2 Contradictions and false promises (High priority)
- **C-1** Phone booking success "Booking confirmed … the booking is fully confirmed once they pay" vs the status, which is CONFIRMED immediately (`actions/booking.ts:79`). The detail-page variant says "Slot is held… payment confirms the booking", which is accurate there (penciled for 7 days). The two flows named "Confirm + deposit link" behave **differently** ❓.
- **C-2** "Auto-charge balance when due — We automatically charge the client's card on the due date." Not implemented.
- **C-3** Landing: "Every plan includes every feature… The only difference is how many bookable spaces" vs Billing cards: "Team members" and "Peak-season pricing" (Growth), "Priority support" (Pro).
- **C-4** Landing FAQ: "downgrade or cancel from your billing settings": not possible in the UI.
- **C-5** Team: "They can sign in with a magic link sent to their email": no invite email is sent.
- **C-6** Tours: "Confirmed visits on the calendar": not on the calendar.
- **C-7** Booking detail: "view their booking, pay, and download documents": no documents.
- **C-8** Add-ons: "show up on quotes and invoices automatically": no invoices; and not addable in phone bookings.
- **C-9** Policies: "Changes apply to new bookings only": cancellation tiers apply live ❓.
- **C-10** Check-email "Dev note" visible in production.
- **C-11** "Send quote" notice "Quote sent to the client by email." even with no email on file.
- **C-12** Deactivate space: "reach out to support to reactivate": no support channel exists in the product.
- **C-13** Onboarding: "Seven quick steps" (correct: 7) but step 4 is optional and the banner says "Finish onboarding to publish" (publishing needs only a space).

### 18.3 Technical wording leaking to users
"Space has no HALF_DAY package configured" (client wizard!) · "end must be after start" (pricing error; possible) · zod defaults ("Too small: expected string to have >=8 characters", "Invalid URL", "Invalid email address") · raw enums OWNER/TRIAL/GROWTH · ISO timestamps "2026-10-01 14:03 UTC" in admin · event types lower-cased in emails · timezones shown as "America/New York" · "acct_dev_…" Stripe ids shown to owners.

### 18.4 Tone
Generally warm and plain ("Nice and tidy.", "See you there.", "Your venue page is live!"). Keep it. Some copy is long (onboarding descriptions, the policies help). Exclamation marks are frequent on client success states.

### 18.5 Key microcopy to preserve (business-critical)
Cancellation sentences ("Cancel 60+ days before the event: full refund of what you've paid."), deposit/balance/security explanations, the 15-minute hold message, "Inquiry / quote — doesn't block the slot", "Changes only affect new bookings — existing prices never change.", the refund preview sentence, the fee disclosures (3%), "Clients never see other clients' details" (landing).

---

## 19. UX Problems

Format: **ID — Where.** Current behaviour → why it matters → who → **severity** → what to investigate.

### Navigation
- **N-1 🐞 Sidebar "Add-ons" is a broken link** (`sidebar.tsx:349` segment `add-ons` vs folder `addons`). → Every role gets a 404 from primary nav. → Owner, Manager. → **Critical**. → Fix the link (engineering). Design must keep Add-ons reachable.
- **N-2 🐞 Role-blind navigation**: Staff see 8 items; Tours, Spaces, Add-ons and Settings 404, as do all detail links from the dashboard, bookings, clients and calendar. Managers see Settings → 404 and the "Setup incomplete" banner → 404. → Users hit dead ends with no explanation. → Staff, Manager. → **Critical**. → Design role-aware navigation and a "no access" state. Engineering must pass the role to the shell (it's already available in `requireVenue`).
- **N-3** No route back to the venue list with only one venue; no account menu; `/admin` unreachable by navigation. → **Medium**.
- **N-4** The onboarding page disappears from view after publishing. → **Low**.
- **N-5** The wizard loses state on refresh, and browser Back leaves it. → Clients restart from scratch. → Client. → **Medium**.

### Discoverability
- **D-1** Creating a booking is only possible from the calendar. There is no "New booking" on the dashboard, bookings list or client page. → Owners on the phone must navigate first. → Owner, Manager. → **High**.
- **D-2** Moving a booking is only possible in the calendar dialog. The detail page has no "Reschedule". → **High**.
- **D-3** The drag-to-move gesture has no affordance (only the cursor changes). → **Medium**.
- **D-4** Quote link not visible to the owner (they can't open or copy the quote they sent). → **Medium**.
- **D-5** Billing (needed when hitting plan limits) has no link from the error. → **Medium**.

### Information hierarchy
- **H-1** Booking detail on mobile puts the Actions card below three long cards. → The main task is buried. → **High**.
- **H-2** The dashboard leads with month stats rather than *today*. Overdue balances, expiring pencils and quotes awaiting response are not surfaced. → **High**.
- **H-3** Venue page: phone and email absent; reviews placeholder takes a full section. → **Medium**.
- **H-4** Wizard step 2: the price is "incl. tax" but the deposit isn't shown until step 5. Instant vs request-to-book is shown as a badge with no explanation. → **Medium**.

### Cognitive load
- **CL-1** Nine booking statuses with industry jargon (Penciled, Checkout hold, Quote sent, Expired hold) shown to clients and staff. → **High**. → Define owner-facing vs client-facing labels.
- **CL-2** Two colour codes on calendar chips (space + status). → **High**.
- **CL-3** The rate plan form is dense (hourly, minimum, overtime, 3 packages, 7 day multipliers, peak periods) on one screen with no live example price. → **Medium**.
- **CL-4** Four equal-weight exits in the phone form. → **Medium**.
- **CL-5** Two sign-in methods side by side. → **Low**.

### Visual hierarchy / Consistency
- **V-1** Three page widths, two title sizes, double padding (§10.7). → **Medium**.
- **V-2** Owner and client surfaces use different card radii, button styles and header implementations; the venue brand colour mixes with indigo on client pages. → **Medium**.
- **V-3** Admin is visually unstyled and breaks in dark mode. → **Medium**.
- **V-4** The OS dark-mode body colour leaks around pages without their own background (`/admin`, `/app` picker gutters). → **Medium**.

### Forms
- **F-1** One error at a time; no field highlighting (§11). → **High**.
- **F-2** No required markers; inconsistent "(optional)". → **Medium**.
- **F-3** Image URLs instead of uploads; no thumbnails for photo URLs. → **High** for non-technical owners (❓ backend).
- **F-4** Two independent forms on the space page; unsaved changes are lost on the other's save. → **Medium**.
- **F-5** Silent dropping of incomplete repeater rows (peak periods, layouts, deductions). → **Medium**.
- **F-6** Phone form silently overwrites an existing client's details when a phone/email matches. → **High** (data integrity perception).
- **F-7** Past dates allowed in phone booking; From > To allowed in peak periods. → **Low**.

### Feedback
- **FB-1** No toasts. Dashboard actions (send payment link, confirm tour, toggles) give no confirmation and don't show the generated link. → **High**.
- **FB-2** "Log inquiry" closes the dialog silently. → **Medium**.
- **FB-3** Stripe returns (`?connected`, `?subscribed`, `?refresh`) show no message. → **Medium**.
- **FB-4** The `/b?paid=1` banner relies on the URL param, not the payment state. → **Low**.

### Error prevention
- **EP-1** Owner cancel has **no refund preview** before the irreversible action (the client side has one). → **Critical** (money).
- **EP-2** Mark no-show has no confirmation. → **Medium**.
- **EP-3** Timezone change, policy change and deactivate space have no impact warnings beyond the space dialog. → **Medium**.
- **EP-4** Inviting as Owner has no warning; there's no last-owner protection. → **Medium**.
- **EP-5** Manual payment amount isn't prefilled and isn't checked against the balance. → **Medium**.
- **EP-6** Publishing is possible with spaces that have no rates (clients see "Pricing on request" and an un-bookable space). → **Medium**.

### Error recovery
- **ER-1 🐞** A client who abandons the deposit checkout (instant-book HOLD or accepted quote → PENCILED) has **no way to pay** from `/b` or `/q`. → Lost bookings. → Client, Owner. → **Critical**. → Engineering: expose a "pay deposit" action; design the state.
- **ER-2** Conflict alternatives in the public wizard are not clickable (they are in the owner form). → **High**.
- **ER-3** Branded 404, no-access and error pages are absent (§10.36). → **High**.
- **ER-4** Inquiries/quotes can't be declined or cancelled by the owner; they accumulate forever in "Pending inquiries". → **High**.
- **ER-5** Expired magic link → unstyled Auth.js page. No password reset. → **High**.

### Accessibility
See §17 (A-1 contrast with brand colours, A-2 field errors, A-3 colour-only, A-4 calendar keyboard: all **High**).

### Responsiveness / Mobile UX
- **M-1** Calendar month and week are unusable on phones, which is where owners take calls. → **Critical**. → Investigate an agenda/list view for mobile.
- **M-2** Drag-to-move doesn't work on touch. → **High** (the dialog form is the fallback).
- **M-3** Tables without mobile fallbacks (add-ons, admin, booking detail price/payments). → **Medium**.
- **M-4** Tablet (768–1023) gets the phone shell. → **Medium**.
- **M-5** Touch targets < 44px (§14). → **Medium**.

### Content clarity
§18: contradictions C-1…C-13 (**High** for C-1, C-2, C-4, C-5), technical wording (**High** in the client wizard).

### User confidence
- **UC-1** No record of who did what (no activity log on bookings, though the audit-log table exists for impersonation only). → **Medium**.
- **UC-2** No owner notifications for new online inquiries, client cancellations or payments. → **High** (❓ product).
- **UC-3** A "Confirmed" booking that hasn't paid its deposit (phone CONFIRM exit) looks identical to a paid one, except in the money columns. → **High**.
- **UC-4** The PENDING payment rows clutter the payments table. → **Medium**.

### Efficiency
- **E-1** No client lookup or autocomplete in the phone form. → **High**.
- **E-2** No bulk actions, no saved filters, no sorting. → **Low**.
- **E-3** No calendar filters by space or status. → **Medium**.

### Data presentation / Dashboard usability
- **DP-1** "Collected this month" and "Lifetime spend" ignore refunds. → **Medium** (❓ intended?).
- **DP-2** No pagination; silent caps of 200/300 rows. → **High** for venues with years of history.
- **DP-3** "Pending inquiries" counts all-time inquiries, including stale ones. → **Medium**.
- **DP-4** Times show without timezone context on client pages; 12h/24h inconsistency in the wizard. → **Medium**.

---

## 20. Business Rules (do not break)

### Booking & availability
1. 🔒 **No double-bookings.** Blocking statuses are HOLD, PENCILED, CONFIRMED, COMPLETED and NO_SHOW. INQUIRY, QUOTE_SENT, CANCELLED and EXPIRED **never block**. The UI must visually distinguish blocking from non-blocking.
2. 🔒 A booking blocks **[start − setup buffer, end + teardown buffer)**. Buffers must be shown (hatched/translucent) wherever occupancy is drawn. Clients are told access opens N minutes early.
3. 🔒 Buffers, prices, deposit, balance due date and security deposit are **snapshotted at booking time**. Editing rates, buffers or policies doesn't change existing bookings (cancellation tiers excepted ❓).
4. 🔒 Availability is computed from bookings. There is no separate "block dates" feature.
5. 🔒 Online instant-book creates a **15-minute HOLD**. Owner pencils last **1–30 days** (default 5). "Confirm + deposit link" from the detail page and quote acceptance create a **7-day pencil**.
6. 🔒 On conflict, offer alternatives: other active spaces with enough capacity (up to 3) and the same weekday and time in the next 8 weeks (up to 3).
7. 🔒 Events may **cross midnight** ("ends next day"). The display must show the end date when it differs.
8. 🔒 All times are shown in the **venue's timezone**, never the viewer's.
9. 🔒 Rescheduling reprices space charges; add-on prices carry over; **the owner must see and confirm a price change** before applying.
10. 🔒 Spaces without a rate plan cannot be booked (online or by phone). Only offered packages are bookable.
11. 🔒 Plan limits: Trial 10, Solo 1, Growth 5, Pro 10 **active** spaces (enforced on creation).

### Money
12. 🔒 Money is integer cents, displayed only via `formatMoney` (USD formatting; whole dollars drop the ".00").
13. 🔒 Deposit = venue deposit % of the total. Balance due = event start − N days. The balance payment **includes the outstanding security deposit**.
14. 🔒 Recording a **manual Deposit confirms** the booking. Paying the deposit online confirms it (webhook-driven; never trust the redirect).
15. 🔒 Cancellation refund = tier % × (deposits + balances paid), chosen by calendar days before the event (most generous matching tier). The **security deposit is always refunded in full** on cancellation. A 0-day tier must exist.
16. 🔒 Security settlement: deductions are capped at the held amount; the remainder is refunded; the client gets an itemised email.
17. 🔒 Platform fee 3% on online deposits and balances; none on security deposits or manual payments. This must stay disclosed to owners.
18. 🔒 Clients can cancel only active bookings **before the event starts**. Owners can cancel only PENCILED/CONFIRMED bookings that haven't ended.
19. 🔒 Quotes are valid for 14 days. Expired, cancelled or expired-booking quotes can't be accepted.

### Privacy & access
20. 🔒 Public pages show **free/busy only**. No client names or details of other bookings, ever.
21. 🔒 Only **published** venues have public pages. Token pages (`/b`, `/q`) work regardless and must not be indexable or guessable.
22. 🔒 Role gating (§5): Owner-only settings and onboarding; Manager+ for money, bookings detail, spaces, add-ons and tours; Staff for read and checklists.
23. 🔒 Super-admin access to a venue is **always audit-logged and visibly bannered**.
24. 🔒 Client notes are internal ("only your team sees these"). The cancel reason entered by the owner **is shared with the client**.

### Lifecycle automation (affects what users see)
25. 🔒 Daily: expired holds → EXPIRED; past CONFIRMED → COMPLETED (thank-you email); balance reminders on the exact days that are 14 and 3 days before the due date; event-week email 5 days before.
26. 🔒 Clients identify via the email links. Client records are matched by phone or email per venue.
27. 🔒 The venue slug is generated once and is permanent (URLs in emails depend on it).

---

## 21. Technical Constraints

### 21.1 Design-flexible (redesign freely, no backend change)
- Every layout, the visual system, typography, colour tokens, iconography, spacing, the app shell and navigation structure (including role-aware nav: the role is already known server-side).
- Page composition and information hierarchy of all 30 screens; merging or splitting tabs; dashboard arrangement using **data already loaded**.
- Calendar rendering (it's custom code; any visual approach is possible), including a mobile agenda view built from the same data.
- Dialog vs page vs drawer choices; toasts; inline validation display (the client can pre-validate with the same zod schemas; they're plain TS); skeletons and `loading.tsx`; branded `not-found.tsx` and `error.tsx`.
- Copy and microcopy (agree business terms first).
- Email templates (HTML strings).
- Client-facing branding treatment (brand colour usage, contrast-safe text colour derivation, logo fallback).
- Using **react-day-picker** (already installed) for date selection; using `tailwindcss-animate` for motion.

### 21.2 Functionally constrained (needs engineering before it can be designed as "working")
- **New dependencies are not allowed** (AGENTS.md). No chart library, Radix or headless UI. Charts must be hand-built (SVG/CSS) or skipped.
- **File upload** for logos and photos: no storage exists.
- **Owner notifications** (email or in-app) for inquiries, payments and cancellations; **invite emails** to team members.
- **Pay deposit from `/b`** for PENCILED/HOLD clients (ER-1).
- **Decline/cancel inquiries**, edit booking details, add-ons in phone bookings, owner-side refund preview (the client preview function exists and could be reused cheaply).
- **Password reset**, account/profile page, remove/change team member, last-owner rule.
- **Plan downgrade/cancel/invoices** (Stripe Billing portal), trial-expiry enforcement, webhook plan-tier update.
- **Auto-charge balance**, evening start-hour enforcement, operating hours (schema field exists, no UI or logic).
- **Pagination and sorting** (queries are capped, not paged).
- **Distinguishing 404 vs no-access vs unpublished** (all use `notFound()`).
- **Unpublish venue**, reactivate space, reorder spaces/add-ons (`sortOrder` exists, no UI).
- **Tours on the calendar**, tour availability.
- **Currency** other than USD (field exists; formatting and inputs assume $).
- Stripe Checkout, Connect onboarding and Billing pages are **Stripe-hosted** and can't be restyled (beyond Stripe's branding settings).
- The magic-link email body comes from Auth.js/Resend defaults unless engineering customises `sendVerificationRequest`.

### 21.3 Browser/platform
Modern evergreen browsers (React 19, native `<dialog>`, CSS `:has` is not used). No PWA/offline. No i18n (English, `en-US` number formats).

---

## 22. Screenshot Index

**Location:** `docs/design-handoff/screenshots/` (PNG, 1× scale; full-page unless the state is a dialog or menu, which are viewport crops). Machine-readable index: `screenshots/manifest.json`.

**Capture setup:** a local dev server against a throwaway Postgres seeded with `prisma/seed.ts` (+ one Staff user, one empty second venue, and one held security deposit for the settle dialog). Viewports: desktop 1440×900, tablet 820×1180, mobile 390×844. Chromium (Playwright). Dev-mode Stripe/email.

**Caveats:** (1) The round black **"N" badge** at bottom-left of every shot is the Next.js dev-tools indicator. It is **not part of the product**. (2) Some screenshots show demo data created *during* capture (e.g. a second "Deborah Eze" tour request, the "Chiamaka Obi" HOLD). (3) Not captured: Stripe-hosted pages, emails, the Auth.js magic-link error page, the framework 500 page, the drag-and-drop gesture itself, and the HOLD state on `/b` (it expires after 15 minutes; it's described in §10.34).

| # | File | Route | Role | Viewport | State |
|---|---|---|---|---|---|
| 1 | `001-landing-desktop.png` | `/` | Visitor | desktop | Default |
| 2 | `002-login-desktop.png` | `/login` | Visitor | desktop | Default |
| 3 | `003-register-desktop.png` | `/register` | Visitor | desktop | Default |
| 4 | `004-venue-page-desktop.png` | `/v/[slug]` | Client | desktop | Populated |
| 5 | `005-book-step1-desktop.png` | `/v/[slug]/book` | Client | desktop | Step 1 empty |
| 6 | `006-tour-form-desktop.png` | `/v/[slug]/tour` | Client | desktop | Default |
| 7 | `007-manage-booking-confirmed-desktop.png` | `/b/[token]` | Client | desktop | Confirmed, balance due |
| 8 | `008-quote-desktop.png` | `/q/[token]` | Client | desktop | Open quote |
| 9 | `009-landing-mobile.png` | `/` | Visitor | mobile | Default |
| 10 | `010-login-mobile.png` | `/login` | Visitor | mobile | Default |
| 11 | `011-register-mobile.png` | `/register` | Visitor | mobile | Default |
| 12 | `012-venue-page-mobile.png` | `/v/[slug]` | Client | mobile | Populated |
| 13 | `013-book-step1-mobile.png` | `/v/[slug]/book` | Client | mobile | Step 1 empty |
| 14 | `014-tour-form-mobile.png` | `/v/[slug]/tour` | Client | mobile | Default |
| 15 | `015-manage-booking-confirmed-mobile.png` | `/b/[token]` | Client | mobile | Confirmed, balance due |
| 16 | `016-quote-mobile.png` | `/q/[token]` | Client | mobile | Open quote |
| 17 | `017-landing-tablet.png` | `/` | Visitor | tablet | Default |
| 18 | `018-login-error-desktop.png` | `/login` | Visitor | desktop | Error: invalid credentials |
| 19 | `019-register-error-desktop.png` | `/register` | Visitor | desktop | Error: account exists |
| 20 | `020-check-email-desktop.png` | `/login/check-email` | Visitor | desktop | Default |
| 21 | `021-404-unknown-venue-desktop.png` | `/v/[slug] (unknown)` | Visitor | desktop | Not found |
| 22 | `022-404-unpublished-venue-desktop.png` | `/v/[slug] (unpublished)` | Visitor | desktop | Not found (unpublished) |
| 23 | `023-404-bad-manage-token-desktop.png` | `/b/[token] (invalid)` | Client | desktop | Not found |
| 24 | `024-app-unauthenticated-redirect-desktop.png` | `/app (signed out)` | Visitor | desktop | Redirected to /login |
| 25 | `025-venue-availability-next-month-desktop.png` | `/v/[slug]?month=` | Client | desktop | Availability next month |
| 26 | `026-book-step1-validation-error-desktop.png` | `/v/[slug]/book` | Client | desktop | Step 1 validation error |
| 27 | `027-book-step2-spaces-desktop.png` | `/v/[slug]/book` | Client | desktop | Step 2 space list (incl. unavailable / not-offered) |
| 28 | `028-book-step3-addons-desktop.png` | `/v/[slug]/book` | Client | desktop | Step 3 add-ons selected, running total |
| 29 | `029-book-step4-details-error-desktop.png` | `/v/[slug]/book` | Client | desktop | Step 4 validation error |
| 30 | `030-book-step4-details-desktop.png` | `/v/[slug]/book` | Client | desktop | Step 4 filled |
| 31 | `031-book-step5-review-desktop.png` | `/v/[slug]/book` | Client | desktop | Step 5 review (instant-book: Pay deposit) |
| 32 | `032-tour-error-past-date-desktop.png` | `/v/[slug]/tour` | Client | desktop | Error: past date |
| 33 | `033-tour-success-desktop.png` | `/v/[slug]/tour` | Client | desktop | Success |
| 34 | `034-manage-booking-paid-banner-desktop.png` | `/b/[token]?paid=1` | Client | desktop | Payment received banner |
| 35 | `035-manage-booking-cancel-dialog-desktop.png` | `/b/[token]` | Client | desktop | Cancel dialog with refund preview |
| 36 | `036-manage-booking-cancelled-desktop.png` | `/b/[token]` | Client | desktop | Cancelled |
| 37 | `037-manage-booking-completed-desktop.png` | `/b/[token]` | Client | desktop | Completed (past) |
| 38 | `038-manage-booking-penciled-desktop.png` | `/b/[token]` | Client | desktop | Penciled (no pay button) |
| 39 | `039-manage-booking-inquiry-desktop.png` | `/b/[token]` | Client | desktop | Inquiry |
| 40 | `040-app-venue-picker-owner-desktop.png` | `/app` | Owner (2 venues) | desktop | Venue picker |
| 41 | `041-app-new-venue-desktop.png` | `/app/new` | Signed-in user | desktop | Default |
| 42 | `042-dashboard-owner-desktop.png` | `/app/[venueSlug]` | Owner | desktop | Populated |
| 43 | `043-calendar-month-desktop.png` | `/app/[venueSlug]/calendar` | Owner | desktop | Month view |
| 44 | `044-calendar-booking-dialog-desktop.png` | `/app/[venueSlug]/calendar` | Owner | desktop | Booking dialog (details + move) |
| 45 | `045-calendar-booking-dialog-move-preview-desktop.png` | `/app/[venueSlug]/calendar` | Owner | desktop | Move preview result |
| 46 | `046-calendar-new-booking-dialog-desktop.png` | `/app/[venueSlug]/calendar` | Owner | desktop | Fast phone booking dialog |
| 47 | `047-calendar-new-booking-validation-desktop.png` | `/app/[venueSlug]/calendar` | Owner | desktop | Validation error |
| 48 | `048-calendar-week-desktop.png` | `/app/[venueSlug]/calendar?view=week` | Owner | desktop | Week timeline |
| 49 | `049-calendar-day-desktop.png` | `/app/[venueSlug]/calendar?view=day` | Owner | desktop | Day timeline |
| 50 | `050-bookings-all-desktop.png` | `/app/[venueSlug]/bookings` | Owner | desktop | All (populated) |
| 51 | `051-bookings-inquiries-tab-desktop.png` | `/app/[venueSlug]/bookings?status=inquiries` | Owner | desktop | Inquiries tab |
| 52 | `052-bookings-search-no-results-desktop.png` | `/app/[venueSlug]/bookings?q=` | Owner | desktop | Search, no results |
| 53 | `053-booking-detail-confirmed-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | Confirmed upcoming |
| 54 | `054-booking-detail-manual-payment-dialog-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | Manual payment dialog |
| 55 | `055-booking-detail-cancel-dialog-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | Cancel dialog (owner) |
| 56 | `056-booking-detail-balance-link-created-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | Success notice + balance link |
| 57 | `057-booking-detail-inquiry-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | Inquiry (quote-stage actions) |
| 58 | `058-booking-detail-pencil-dialog-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | Pencil hold dialog |
| 59 | `059-booking-detail-quote-sent-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | Quote sent |
| 60 | `060-booking-detail-penciled-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | Penciled (hold expiry) |
| 61 | `061-booking-detail-completed-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | Completed (settle security) |
| 62 | `062-booking-detail-cancelled-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | Cancelled (no actions) |
| 63 | `063-booking-detail-no-show-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | No-show (no actions) |
| 64 | `064-clients-desktop.png` | `/app/[venueSlug]/clients` | Owner | desktop | Populated |
| 65 | `065-client-detail-desktop.png` | `/app/[venueSlug]/clients/[id]` | Owner | desktop | Populated |
| 66 | `066-tours-desktop.png` | `/app/[venueSlug]/tours` | Owner | desktop | Pending / upcoming / past |
| 67 | `067-spaces-desktop.png` | `/app/[venueSlug]/spaces` | Owner | desktop | Populated |
| 68 | `068-space-new-desktop.png` | `/app/[venueSlug]/spaces/new` | Owner | desktop | Empty form |
| 69 | `069-space-detail-desktop.png` | `/app/[venueSlug]/spaces/[id]` | Owner | desktop | Space form + rates + danger zone |
| 70 | `070-space-deactivate-dialog-desktop.png` | `/app/[venueSlug]/spaces/[id]` | Owner | desktop | Deactivate confirm dialog |
| 71 | `071-addons-sidebar-link-404-desktop.png` | `/app/[venueSlug]/add-ons (sidebar link)` | Owner | desktop | BROKEN: 404 from sidebar |
| 72 | `072-addons-desktop.png` | `/app/[venueSlug]/addons` | Owner | desktop | Populated |
| 73 | `073-addon-edit-dialog-desktop.png` | `/app/[venueSlug]/addons` | Owner | desktop | Edit add-on dialog |
| 74 | `074-settings-general-desktop.png` | `/app/[venueSlug]/settings` | Owner | desktop | Default |
| 75 | `075-settings-policies-desktop.png` | `/app/[venueSlug]/settings/policies` | Owner | desktop | Default |
| 76 | `076-settings-branding-desktop.png` | `/app/[venueSlug]/settings/branding` | Owner | desktop | Default |
| 77 | `077-settings-payments-desktop.png` | `/app/[venueSlug]/settings/payments` | Owner | desktop | Default |
| 78 | `078-settings-billing-desktop.png` | `/app/[venueSlug]/settings/billing` | Owner | desktop | Default |
| 79 | `079-settings-team-desktop.png` | `/app/[venueSlug]/settings/team` | Owner | desktop | Default |
| 80 | `080-onboarding-complete-desktop.png` | `/app/[venueSlug]/onboarding` | Owner | desktop | All steps done |
| 81 | `081-empty-dashboard-desktop.png` | `/app/[venueSlug]` | Owner (new venue) | desktop | Empty + setup banner |
| 82 | `082-empty-onboarding-desktop.png` | `/app/[venueSlug]/onboarding` | Owner (new venue) | desktop | Nothing done |
| 83 | `083-empty-onboarding-publish-error-desktop.png` | `/app/[venueSlug]/onboarding` | Owner (new venue) | desktop | Publish error (no spaces) |
| 84 | `084-empty-calendar-desktop.png` | `/app/[venueSlug]/calendar` | Owner (new venue) | desktop | Empty |
| 85 | `085-empty-bookings-desktop.png` | `/app/[venueSlug]/bookings` | Owner (new venue) | desktop | Empty |
| 86 | `086-empty-clients-desktop.png` | `/app/[venueSlug]/clients` | Owner (new venue) | desktop | Empty |
| 87 | `087-empty-tours-desktop.png` | `/app/[venueSlug]/tours` | Owner (new venue) | desktop | Empty |
| 88 | `088-empty-spaces-desktop.png` | `/app/[venueSlug]/spaces` | Owner (new venue) | desktop | Empty |
| 89 | `089-empty-addons-desktop.png` | `/app/[venueSlug]/addons` | Owner (new venue) | desktop | Empty |
| 90 | `090-empty-settings-billing-trial-desktop.png` | `/app/[venueSlug]/settings/billing` | Owner (new venue) | desktop | Trial |
| 91 | `091-empty-settings-payments-not-connected-desktop.png` | `/app/[venueSlug]/settings/payments` | Owner (new venue) | desktop | Stripe not connected |
| 92 | `092-dashboard-owner-mobile.png` | `/app/[venueSlug]` | Owner | mobile | Populated |
| 93 | `093-nav-menu-open-mobile.png` | `(app shell)` | Owner | mobile | Mobile slide-over menu |
| 94 | `094-calendar-month-mobile.png` | `/app/[venueSlug]/calendar` | Owner | mobile | Month view |
| 95 | `095-calendar-week-mobile.png` | `/app/[venueSlug]/calendar?view=week` | Owner | mobile | Week timeline (horizontal scroll) |
| 96 | `096-calendar-new-booking-dialog-mobile.png` | `/app/[venueSlug]/calendar` | Owner | mobile | Fast phone booking dialog |
| 97 | `097-bookings-mobile.png` | `/app/[venueSlug]/bookings` | Owner | mobile | Cards |
| 98 | `098-booking-detail-confirmed-mobile.png` | `/app/[venueSlug]/bookings/[id]` | Owner | mobile | Confirmed upcoming |
| 99 | `099-clients-mobile.png` | `/app/[venueSlug]/clients` | Owner | mobile | Cards |
| 100 | `100-space-detail-mobile.png` | `/app/[venueSlug]/spaces/[id]` | Owner | mobile | Long form |
| 101 | `101-addons-mobile.png` | `/app/[venueSlug]/addons` | Owner | mobile | Table (horizontal scroll) |
| 102 | `102-settings-policies-mobile.png` | `/app/[venueSlug]/settings/policies` | Owner | mobile | Default |
| 103 | `103-tours-mobile.png` | `/app/[venueSlug]/tours` | Owner | mobile | Default |
| 104 | `104-dashboard-owner-tablet.png` | `/app/[venueSlug]` | Owner | tablet | Populated |
| 105 | `105-nav-menu-open-tablet.png` | `(app shell)` | Owner | tablet | Mobile slide-over menu |
| 106 | `106-calendar-month-tablet.png` | `/app/[venueSlug]/calendar` | Owner | tablet | Month view |
| 107 | `107-calendar-week-tablet.png` | `/app/[venueSlug]/calendar?view=week` | Owner | tablet | Week timeline (horizontal scroll) |
| 108 | `108-calendar-new-booking-dialog-tablet.png` | `/app/[venueSlug]/calendar` | Owner | tablet | Fast phone booking dialog |
| 109 | `109-bookings-tablet.png` | `/app/[venueSlug]/bookings` | Owner | tablet | Cards |
| 110 | `110-booking-detail-confirmed-tablet.png` | `/app/[venueSlug]/bookings/[id]` | Owner | tablet | Confirmed upcoming |
| 111 | `111-dashboard-manager-desktop.png` | `/app/[venueSlug]` | Manager | desktop | Populated |
| 112 | `112-settings-manager-404-desktop.png` | `/app/[venueSlug]/settings` | Manager | desktop | Not found (role too low, but link visible) |
| 113 | `113-onboarding-manager-404-desktop.png` | `/app/[venueSlug]/onboarding` | Manager | desktop | Not found |
| 114 | `114-dashboard-staff-desktop.png` | `/app/[venueSlug]` | Staff | desktop | Populated (no payment/tour actions) |
| 115 | `115-calendar-week-staff-desktop.png` | `/app/[venueSlug]/calendar?view=week` | Staff | desktop | No New booking button |
| 116 | `116-calendar-booking-dialog-staff-desktop.png` | `/app/[venueSlug]/calendar` | Staff | desktop | Read-only dialog |
| 117 | `117-bookings-staff-desktop.png` | `/app/[venueSlug]/bookings` | Staff | desktop | List (rows link to 404) |
| 118 | `118-booking-detail-staff-404-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Staff | desktop | Not found (role too low) |
| 119 | `119-spaces-staff-404-desktop.png` | `/app/[venueSlug]/spaces` | Staff | desktop | Not found (role too low) |
| 120 | `120-admin-light-desktop.png` | `/admin` | Super-admin | desktop | OS light mode |
| 121 | `121-app-superadmin-no-venues-desktop.png` | `/app (super-admin, no memberships)` | Super-admin | desktop | Redirected to /app/new |
| 122 | `122-impersonation-dashboard-desktop.png` | `/app/[venueSlug] (impersonating)` | Super-admin | desktop | Impersonation banner |
| 123 | `123-admin-after-impersonation-desktop.png` | `/admin` | Super-admin | desktop | Audit log populated |
| 124 | `124-admin-dark-desktop.png` | `/admin` | Super-admin | desktop | OS dark mode |
| 125 | `125-app-new-venue-dark-desktop.png` | `/app/new` | Signed-in user | desktop | OS dark mode |
| 126 | `126-admin-mobile.png` | `/admin` | Super-admin | mobile | Table overflow |
| 127 | `127-app-venue-picker-dark-desktop.png` | `/app` | Owner (2 venues) | desktop | OS dark mode |
| 128 | `128-book-step5-request-to-book-desktop.png` | `/v/[slug]/book` | Client | desktop | Step 5 review (request-to-book) |
| 129 | `129-book-inquiry-success-desktop.png` | `/v/[slug]/book` | Client | desktop | Inquiry success |
| 130 | `130-booking-detail-completed-security-held-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | Completed, security deposit held |
| 131 | `131-booking-detail-settle-dialog-desktop.png` | `/app/[venueSlug]/bookings/[id]` | Owner | desktop | Settle security deposit dialog with deduction |

---

## 23. Screen Priority Matrix

> **Inferred from product structure. No analytics exist in the codebase.** Frequency is a reasoned estimate, based on how often each workflow would plausibly be used by a small venue.

| Screen | Importance | Frequency | Workflow | Tier |
|---|---|---|---|---|
| This week (dashboard) | Critical | Very High | Primary | 1 |
| Calendar (month/week/day) + New booking + Booking dialog | Critical | Very High | Primary | 1 |
| Booking detail (+4 dialogs) | Critical | High | Primary | 1 |
| Bookings list | High | High | Primary | 1 |
| Public venue page | Critical | Very High (clients) | Primary | 1 |
| Booking wizard (5 steps + outcomes) | Critical | High (clients) | Primary | 1 |
| Manage my booking `/b` (+cancel dialog) | Critical | Medium (clients) | Primary | 1 |
| Quote `/q` | High | Medium | Primary | 1 |
| App shell / navigation (desktop + mobile) | Critical | Very High | Primary | 1 |
| Transactional emails | High | High (clients) | Primary | 1 |
| Onboarding | High | Low (once per venue) | Primary for activation | 2 |
| Spaces list / new / detail (rates) | High | Low | Secondary | 2 |
| Clients list / detail | Medium | Medium | Secondary | 2 |
| Tours (owner) / Book a tour (client) | Medium | Low–Medium | Secondary | 2 |
| Settings › Policies | High | Low | Secondary | 2 |
| Settings › Payments | High | Very Low | Secondary (activation) | 2 |
| Register / Login / Check email | High | Medium | Primary (entry) | 2 |
| Landing | High | High (visitors) | Primary (acquisition) | 2 |
| Add-ons | Medium | Low | Secondary | 2 |
| Settings › General / Branding / Billing / Team | Medium | Very Low | Utility | 3 |
| Venue picker `/app`, Create venue `/app/new` | Medium | Low | Utility | 3 |
| Super-admin `/admin` | Medium (internal) | Low | Utility | 3 |
| 404 / no-access / unpublished / error / auth-error / loading | High (trust) | Low | Utility | 3 |

---

## 24. Future Design-System Requirements

Families of components the designer should expect to define (no designs are prescribed here):

1. **Foundations:** colour tokens (neutral scale, one Venuora brand accent, semantic success/warning/danger/info), **status token set** (9 booking + 4 payment + 5 tour statuses, each with a background, foreground, bar/fill and a non-colour cue such as an icon or pattern), **space palette** (8 calendar colours), **venue-brand theming** (a runtime brand colour with an auto-computed accessible on-colour and tints), typography scale (incl. a tabular-numeral style for money), spacing scale, radius, elevation, motion, and breakpoints (consider adding `xl` behaviour and a tablet layout).
2. **Actions:** Button (primary/secondary/outline/ghost/destructive/success + brand-themed variant; sizes; icon-only; loading), Link, Icon button, Copy-to-clipboard field.
3. **Inputs:** Text, Email, Tel, Number, Currency (prefix), Percent/unit (suffix), Textarea, Select, Checkbox, Checkbox card, Radio/segmented choice, Switch (Active, Instant book, Auto-charge), Date picker (react-day-picker available), Time picker (15/30-min), Date range (peak periods), Colour swatch picker + custom colour, Quantity stepper, Repeater row pattern, Chips input (amenities), URL/image list (or an uploader, if engineering adds storage), Search field.
4. **Form scaffolding:** Label, help text, field-level error, form-level error summary, required/optional marker, section headers, sticky save bar, unsaved-changes guard.
5. **Feedback:** Inline alert (4 tones), Toast, Banner (impersonation, setup incomplete, hold countdown, payment received), Empty state (with icon/illustration and CTA), Skeletons, Spinner, Progress bar, Stepper (wizard), Checklist (onboarding).
6. **Data display:** Card, Stat tile, Data table (sortable header, row link, responsive card fallback), Definition list, Price breakdown, Payment ledger, Status badge, Role badge, Plan badge, Timeline/activity list, Avatar/initial tile (venue logo fallback).
7. **Calendar family:** Month grid cell + event chip, timeline row + booking bar with buffer hatching and tentative styling, current-time marker, legend, availability day cell (free/partly/full/past), mobile agenda list, drag affordance.
8. **Overlays:** Modal dialog (sizes, header with close, footer actions, result state), Confirmation dialog (destructive, with consequence preview), Drawer/slide-over (mobile nav; possibly booking quick view), Tooltip, Popover/menu (account menu, row actions).
9. **Navigation:** App sidebar (role-aware), mobile top bar + drawer, venue switcher, tabs (page-level and pill), segmented control, breadcrumb/back link, pagination, public header/footer (Venuora and venue-branded variants).
10. **Templates:** Owner page (header + actions + content), Settings page, Detail page (main + side column), Public venue page, Token page (`/b`, `/q`), Auth page, System page (404/403/500), Email layout.

---

## 25. Questions / Unknowns

Each needs a product-owner decision. The answer changes the design.

1. **Should Staff see booking details (read-only)?** Today the list is visible but detail 404s. → Decides whether Staff navigation shows detail links at all.
2. **Should Managers see Settings › General/Branding?** The server actions allow it, the pages don't. → Settings IA.
3. **Is "Confirm + deposit link" meant to confirm immediately (phone form) or pencil for 7 days (detail page)?** → One label and one status story.
4. **Do cancellation-tier changes apply to existing bookings?** (Code: yes, live.) → Policy copy and warnings.
5. **Owner notifications** for new online inquiries, client cancellations and payments: email, in-app, both or none? → Notification centre / badge design.
6. **Client-facing status vocabulary:** should clients see "Penciled" / "Checkout hold"? → Public status labels.
7. **Reviews section:** keep the placeholder, hide it, or plan a feature? → Venue page layout.
8. **File uploads** for logos and photos: will engineering add storage? → Branding and space forms (uploader vs URL list).
9. **Plan management:** will a Stripe Billing portal (cancel/downgrade/invoices) be added? What happens when the trial ends, or on a downgrade below the active space count? → Billing states.
10. **Team management:** remove member, change role, invite emails, pending invites, last-owner protection. In scope? → Team page.
11. **Unpublish / reactivate space / reorder spaces:** in scope? → Danger zones and list affordances.
12. **Auto-charge balance:** remove the option or implement it? → Policies form.
13. **Operating hours** (schema field, no UI) and **evening start hour** (stored, unused): should either constrain booking or tours? → Wizard, tour form, rates.
14. **Currency:** USD only, or multi-currency per venue? → Every money input and format.
15. **Magic-link landing destination** and the **Auth.js error page**: confirm the intended flow. → Auth screens.
16. **Password reset:** required? → Login.
17. **Deposit retry for PENCILED/HOLD clients** (ER-1): will engineering expose it on `/b`? → `/b` states.
18. **Should owners be able to decline or archive inquiries?** → Inquiry lifecycle and dashboard counts.
19. **Phone-booking client matching:** silently merge-and-overwrite, or ask? → Phone form with client lookup.
20. **Revenue metrics:** should "Collected" and "Lifetime spend" net out refunds? → Dashboard and clients.
21. **Hard-coded demo link** on the landing ("See a live venue page" → `regency-event-center`): will that venue exist in production? → Landing.
22. **Dark mode:** support it (globals.css half-implements it) or force light everywhere? → Token set scope.
23. **Plan tier update in live Stripe** (webhook doesn't set `planTier`): engineering to confirm before designing post-purchase states.
24. **Tours on the calendar:** intended (copy says so)? → Calendar legend and data.

---

## 26. Designer Checklist

Legend: ✅ exists today and must be (re)designed · **RD** = Requires Design (missing today or broken; must be created) · N/A = not applicable.

| Screen | Route | Desktop | Tablet | Mobile | Default | Loading | Empty | Error | Modal/Overlay | Role(s) | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Landing | `/` | ✅ | ✅ | ✅ | ✅ | N/A | N/A | N/A | N/A | Visitor | signed-in variant RD |
| Sign in | `/login` | ✅ | ✅ | ✅ | ✅ | ✅ (button) | N/A | ✅ | N/A | Visitor | forgot-password RD ❓ |
| Check email | `/login/check-email` | ✅ | ✅ | ✅ | ✅ | N/A | N/A | N/A | N/A | Visitor | remove dev note |
| Auth error (expired link) | Auth.js | RD | RD | RD | RD | N/A | N/A | RD | N/A | Visitor | currently unstyled |
| Register | `/register` | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | N/A | Visitor | |
| Venue picker | `/app` | ✅ | ✅ | ✅ | ✅ | RD | N/A (redirects) | RD | N/A | All members | dark-mode bug |
| Create venue | `/app/new` | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | N/A | Signed-in | |
| App shell + nav | layout | ✅ | RD (tablet layout) | ✅ | ✅ | RD (route loading) | N/A | RD | ✅ drawer | Owner/Mgr/Staff/Admin | role-aware nav RD; banners |
| This week | `/app/[v]` | ✅ | ✅ | ✅ | ✅ | RD | ✅ (3 sections) | RD | N/A | All roles | staff variant |
| Onboarding | `/app/[v]/onboarding` | ✅ | ✅ | ✅ | ✅ | ✅ (publish) | ✅ (0/7) | ✅ | N/A | Owner | complete state |
| Calendar month | `/calendar` | ✅ | ✅ | RD (unusable) | ✅ | RD | ✅ (no spaces) | RD | ✅ | All (read-only staff) | mobile agenda RD |
| Calendar week/day | `/calendar?view=` | ✅ | ✅ | RD | ✅ | RD | ✅ | RD | ✅ | All | drag, buffers |
| New booking dialog | calendar | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ (+alternatives) | ✅ | Mgr/Owner | success (deposit link) state |
| Booking quick view / move | calendar | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | All (move: Mgr+) | price-change preview |
| Bookings list | `/bookings` | ✅ | ✅ | ✅ | ✅ | RD | ✅ / search-empty | RD | N/A | All | 7 tabs, pagination RD |
| Booking detail | `/bookings/[id]` | ✅ | ✅ | ✅ | ✅ (7 status variants) | ✅ (buttons) | ✅ (no payments) | ✅ | ✅ ×4 + results | Mgr/Owner | no-access for staff RD |
| Clients list | `/clients` | ✅ | ✅ | ✅ | ✅ | RD | ✅ | RD | N/A | All | |
| Client detail | `/clients/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (no bookings) | ✅ | N/A | Mgr/Owner | |
| Tours | `/tours` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ ×3 | RD | N/A | Mgr/Owner | |
| Spaces list | `/spaces` | ✅ | ✅ | ✅ | ✅ | RD | ✅ | RD | N/A | Mgr/Owner | inactive variant |
| New space | `/spaces/new` | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ (+plan limit) | N/A | Mgr/Owner | |
| Space detail + rates | `/spaces/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (no rates) | ✅ | ✅ deactivate | Mgr/Owner | |
| Add-ons | `/addons` | ✅ | ✅ | RD (table) | ✅ | ✅ | ✅ | ✅ | ✅ create/edit + confirm | Mgr/Owner | fix nav link |
| Settings › General | `/settings` | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | N/A | Owner | |
| Settings › Policies | `/settings/policies` | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | N/A | Owner | policy preview RD |
| Settings › Branding | `/settings/branding` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (no logo/photos) | ✅ | N/A | Owner | contrast warning RD |
| Settings › Payments | `/settings/payments` | ✅ | ✅ | ✅ | ✅ ×3 states | N/A | ✅ | RD (return states) | N/A | Owner | |
| Settings › Billing | `/settings/billing` | ✅ | ✅ | ✅ | ✅ (trial / paid) | N/A | N/A | RD | N/A | Owner | trial-expired RD ❓ |
| Settings › Team | `/settings/team` | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | N/A | Owner | remove/role change ❓ |
| Super-admin | `/admin` | ✅ | ✅ | RD | ✅ | RD | ✅ (audit log) | RD | N/A | Super-admin | dark-mode bug |
| Impersonation banner | shell | ✅ | ✅ | ✅ | ✅ | N/A | N/A | N/A | N/A | Super-admin | |
| Public venue page | `/v/[slug]` | ✅ | ✅ | ✅ | ✅ | RD | ✅ (no spaces/photos) | ✅ (404) | RD (gallery?) | Client | brand-themed |
| Booking wizard | `/v/[slug]/book` | ✅ | ✅ | ✅ | ✅ ×5 steps | ✅ | ✅ (no spaces/add-ons) | ✅ (+conflict) | N/A | Client | success, redirecting |
| Book a tour | `/v/[slug]/tour` | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | N/A | Client | success |
| Manage booking | `/b/[token]` | ✅ | ✅ | ✅ | ✅ (≥7 status variants) | ✅ | ✅ (no payments) | ✅ | ✅ cancel + result | Client | pay-deposit state RD |
| Quote | `/q/[token]` | ✅ | ✅ | ✅ | ✅ (open/accepted/expired/inactive) | ✅ | N/A | ✅ | N/A | Client | |
| 404 not found | any | RD | RD | RD | RD | N/A | N/A | RD | N/A | All | Venuora + venue-branded variants |
| No access (403) | role-gated | RD | RD | RD | RD | N/A | N/A | RD | N/A | Staff/Manager | new |
| Venue unpublished | `/v/[slug]` | RD | RD | RD | RD | N/A | N/A | RD | N/A | Client | new |
| Server error | any | RD | RD | RD | RD | N/A | N/A | RD | N/A | All | |
| Route loading | any | RD | RD | RD | N/A | RD | N/A | N/A | N/A | All | skeletons |
| Emails (11 + magic link) | email | ✅ | N/A | ✅ | ✅ | N/A | N/A | ✅ (payment failed, unused) | N/A | Client, Owner | brand-colour contrast |
| Stripe hand-offs | external | ✅ | ✅ | ✅ | ✅ (return banners) | ✅ (redirecting) | N/A | RD (abandoned checkout) | N/A | Client, Owner | |

---

## 27. Coverage Verification

**Final QC pass.** After writing, I re-searched the source for routes (`find src/app -name page.tsx` → 30), dialogs (`<Dialog` usages → 9 + native confirm/prompt), forms (`<form`, `onSubmit`, `action=`), role guards (`requireVenue(…, "MANAGER"|"OWNER")`), status gating (`quoteStage`, `activeStage`, `settleStage`, `canPayBalance`, `canCancel`), empty-state strings, `notFound()` callers, `loading`/`error`/`not-found` files (none exist), and the mobile nav. Every item found is accounted for above. Items added during QC: the Auth.js error page, `addressLine2` with no input, `?pay=balance` being ignored, the plan-tier webhook gap, unused `paymentFailedEmail` and `sendInquiryAckAction`, and the dark-mode white-on-white table cells in admin.

| Metric | Count |
|---|---|
| Total routes discovered | **30 page routes** + 4 API routes + framework 404/error + Auth.js error page (+1 broken link target `/add-ons`) |
| Total screens documented (§10) | **36 sections** covering 30 routes, the app shell, settings layout, calendar dialogs, emails, and system screens; **44 rows** in the designer checklist |
| Total user roles | **6** (Visitor, Client, Staff, Manager, Owner, Super-admin) + 1 transitional state (signed in, no venue) |
| Total forms | **31** (23 data-entry + 8 single-action) |
| Total dialogs/modals | **9 custom dialogs** (New booking, Booking/Move, Pencil hold, Manual payment, Owner cancel, Settle security, Deactivate space, Add-on create/edit, Client cancel) + 1 slide-over drawer + 3 native browser prompts (confirm ×1, prompt ×2) |
| Total major workflows | **24** (§9 J1–J24) |
| Reusable UI components/patterns identified | **~45** (11 kit pieces, 7 shared, ~30 route-local, 19 implicit patterns; overlaps de-duplicated) |
| Screens requiring responsive redesign | **10** with significant issues: calendar month, calendar week/day, new-booking dialog, booking detail, add-ons, admin, space detail, bookings table (768–1000), shell at tablet, landing pricing at 768–900 |
| Known states documented | **24 generic UI states** (§13) + 9 booking, 4 payment, 5 tour and 4 venue-level status families |
| Screenshots | **131** (desktop 102, mobile 21, tablet 8), indexed in §22 |

### Areas I could not inspect, and why
- **Stripe-hosted pages** (Checkout, Connect onboarding, subscription Checkout): the app runs in dev mode with placeholder keys, which substitutes an instant redirect. Not captured.
- **Emails**: templates were read in full but not rendered or screenshotted. The magic-link email is an Auth.js default that I could not see.
- **Auth.js error page** (expired or used magic link) and the **framework 500 page**: not triggered.
- **HOLD state on `/b`**: described from code; not captured, because the 15-minute hold is created only during a live checkout redirect.
- **Live drag-and-drop** on the calendar: only the dialog it opens was captured (move preview).
- **Production behaviour of webhook-driven states** (plan-tier updates, Stripe Connect `account.updated`, payment failures) was inferred from code only.
- **Real-world data volumes:** the seed has about 65 bookings and 20 clients. Behaviour at hundreds or thousands of rows (uncapped admin table, 200/300-row caps) is inferred, not observed.
- **Analytics/usage data:** none exist; §23 priorities are inferred.

I do **not** claim 100% coverage of runtime behaviour. Coverage of the **source code's user-facing surface** (routes, components, forms, dialogs, states and copy) is complete as of commit `95d177e`.
