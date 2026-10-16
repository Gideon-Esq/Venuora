# Integration and system-state review

Source review completed on 15 October 2026. This is an implementation inventory, not a browser QA or WCAG certification.

## Recovery and loading coverage

| Route | Loading boundary | Error boundary | Missing-resource boundary |
| --- | --- | --- | --- |
| `/admin` | None | `src/app/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/addons` | `src/app/app/[venueSlug]/addons/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/bookings/[id]` | `src/app/app/[venueSlug]/bookings/[id]/loading.tsx` | `src/app/app/[venueSlug]/bookings/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/bookings` | `src/app/app/[venueSlug]/bookings/loading.tsx` | `src/app/app/[venueSlug]/bookings/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/calendar` | `src/app/app/[venueSlug]/calendar/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/clients/[id]` | `src/app/app/[venueSlug]/clients/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/clients` | `src/app/app/[venueSlug]/clients/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/emails` | `src/app/app/[venueSlug]/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/onboarding` | `src/app/app/[venueSlug]/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]` | `src/app/app/[venueSlug]/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/records` | `src/app/app/[venueSlug]/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/settings/billing` | `src/app/app/[venueSlug]/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/settings/branding` | `src/app/app/[venueSlug]/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/settings/general` | `src/app/app/[venueSlug]/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/settings` | `src/app/app/[venueSlug]/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/settings/payments` | `src/app/app/[venueSlug]/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/settings/policies` | `src/app/app/[venueSlug]/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/settings/team` | `src/app/app/[venueSlug]/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/spaces/[id]` | `src/app/app/[venueSlug]/spaces/[id]/loading.tsx` | `src/app/app/[venueSlug]/spaces/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/spaces/new` | `src/app/app/[venueSlug]/spaces/new/loading.tsx` | `src/app/app/[venueSlug]/spaces/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/spaces` | `src/app/app/[venueSlug]/spaces/loading.tsx` | `src/app/app/[venueSlug]/spaces/error.tsx` | `src/app/not-found.tsx` |
| `/app/[venueSlug]/tours` | `src/app/app/[venueSlug]/tours/loading.tsx` | `src/app/app/[venueSlug]/error.tsx` | `src/app/not-found.tsx` |
| `/app/new` | None | `src/app/error.tsx` | `src/app/not-found.tsx` |
| `/app` | None | `src/app/error.tsx` | `src/app/not-found.tsx` |
| `/b/[token]` | `src/app/b/[token]/loading.tsx` | `src/app/error.tsx` | `src/app/b/[token]/not-found.tsx` |
| `/login/check-email` | None | `src/app/error.tsx` | `src/app/not-found.tsx` |
| `/login/error` | None | `src/app/error.tsx` | `src/app/not-found.tsx` |
| `/login` | None | `src/app/error.tsx` | `src/app/not-found.tsx` |
| `/` | None | `src/app/error.tsx` | `src/app/not-found.tsx` |
| `/q/[token]` | `src/app/q/[token]/loading.tsx` | `src/app/error.tsx` | `src/app/q/[token]/not-found.tsx` |
| `/register` | None | `src/app/error.tsx` | `src/app/not-found.tsx` |
| `/v/[slug]/book` | `src/app/v/[slug]/book/loading.tsx` | `src/app/error.tsx` | `src/app/v/[slug]/not-found.tsx` |
| `/v/[slug]` | `src/app/v/[slug]/loading.tsx` | `src/app/error.tsx` | `src/app/v/[slug]/not-found.tsx` |
| `/v/[slug]/tour` | `src/app/v/[slug]/tour/loading.tsx` | `src/app/error.tsx` | `src/app/v/[slug]/not-found.tsx` |

## Applied improvements

- Public venue, date selection, tour request, private quote and workspace tour routes have contextual loading geometry. Existing dashboard, calendar, bookings, clients and spaces placeholders remain in place.
- Root errors disable retry while recovery is pending. Invalid sign-in links lead to a dedicated recovery page without echoing raw provider errors.
- Offline detection preserves the mounted route and warns before saving or paying. It does not claim offline persistence, queue payments or retry mutations automatically.
- Native dialogs keep browser focus containment and Escape behavior, use a heading for their accessible name when present, and expose a 44px close control. Shared default buttons and mobile small buttons now have 44px targets.
- Existing-member invites cannot silently overwrite roles. No new role-changing or removal workflow was added.
- Public missing-venue and private missing-token pages have separate recovery copy. Public missing and unpublished venue records remain indistinguishable, preserving privacy.

## Contracts retained

- Tenant reads and mutations require the appropriate venue role and remain scoped to venue identity. Unauthorized cross-tenant records remain hidden behind not-found behavior; this review does not introduce an experimental 403 API or reveal venue existence.
- Money stays in integer cents and renders through formatMoney. Dates and times use venue-timezone helpers. Booking buffers remain part of the blocked interval.
- Publishing currently requires one active space. Rates and Stripe govern online pricing and payment readiness, rather than blocking publication.
- Refunds and security deposits follow the existing server payment actions; UI examples do not override backend policy.
- Status examples in the supplied design are guidance only. Production screens show the actual record state, not multiple contradictory success/error states.

## Browser verification still required

- Check 320, 375, 390, 768, 1024, 1440 and 1920px widths, including keyboard-only navigation, zoom and horizontal overflow.
- Exercise native-dialog focus return, Escape, long-content scrolling and screen-reader announcements.
- Simulate offline/reconnect and slow data loads. Verify unsent values remain while mounted; reload persistence is not promised.
- Verify owner/manager/staff and cross-tenant access with authenticated sessions; this source inventory is not an end-to-end authorization test.
- Exercise payment failure, simultaneous slot claims, cross-midnight bookings, DST boundaries, quote expiry and cancellation recovery against a test payment provider.
- Check custom brand colors and full rendered contrast in the browser and supported email clients. No complete WCAG 2.2 AA audit has been performed.
