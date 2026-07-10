-- Core promise of the product: the DATABASE refuses overlapping bookings.
-- The blocked interval is [blockedStart, blockedEnd) = event time expanded by
-- setup/teardown buffers. Only "blocking" statuses participate; INQUIRY,
-- QUOTE_SENT, CANCELLED and EXPIRED never block a slot.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_no_double_booking"
  EXCLUDE USING gist (
    "spaceId" WITH =,
    tsrange("blockedStart", "blockedEnd", '[)') WITH &&
  )
  WHERE ("status" IN ('HOLD', 'PENCILED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'));

-- Sanity: [start, end) is non-empty and always contained in the blocked range.
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_time_sanity"
  CHECK ("start" < "end" AND "blockedStart" <= "start" AND "end" <= "blockedEnd");

-- Blocking holds must always carry an expiry so they can be released.
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_hold_needs_expiry"
  CHECK ("status" NOT IN ('HOLD', 'PENCILED') OR "holdExpiresAt" IS NOT NULL);
