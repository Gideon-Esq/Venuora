// Shared display labels & colors — keep every screen speaking the same
// plain language (the buyer is a non-technical venue owner).

import type { BookingStatus, EventType, SlotType } from "@/generated/prisma/enums";

export const STATUS_LABELS: Record<BookingStatus, string> = {
  INQUIRY: "Inquiry",
  QUOTE_SENT: "Quote sent",
  HOLD: "Checkout hold",
  PENCILED: "Penciled",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
  EXPIRED: "Expired hold",
};

/** Tailwind classes for status chips. */
export const STATUS_STYLES: Record<BookingStatus, string> = {
  INQUIRY: "bg-sky-100 text-sky-800",
  QUOTE_SENT: "bg-violet-100 text-violet-800",
  HOLD: "bg-amber-100 text-amber-800",
  PENCILED: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-zinc-200 text-zinc-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  NO_SHOW: "bg-orange-100 text-orange-800",
  EXPIRED: "bg-zinc-100 text-zinc-500",
};

/** Solid colors for calendar bars, keyed by status. */
export const STATUS_BAR_COLORS: Record<BookingStatus, string> = {
  INQUIRY: "#38bdf8",
  QUOTE_SENT: "#a78bfa",
  HOLD: "#fbbf24",
  PENCILED: "#facc15",
  CONFIRMED: "#10b981",
  COMPLETED: "#a1a1aa",
  CANCELLED: "#fb7185",
  NO_SHOW: "#fb923c",
  EXPIRED: "#d4d4d8",
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  WEDDING: "Wedding",
  BIRTHDAY: "Birthday",
  CONFERENCE: "Conference",
  CHURCH_PROGRAM: "Church program",
  CORPORATE: "Corporate",
  OTHER: "Other",
};

export const SLOT_TYPE_LABELS: Record<SlotType, string> = {
  HOURLY: "Hourly",
  HALF_DAY: "Half-day package",
  FULL_DAY: "Full-day package",
  EVENING: "Evening package",
};

export const AMENITY_SUGGESTIONS = [
  "Stage",
  "Sound system",
  "Projector & screen",
  "Kitchen access",
  "Parking",
  "Changing rooms",
  "Generator / backup power",
  "Air conditioning",
  "WiFi",
  "Wheelchair accessible",
  "Outdoor area",
  "Dance floor",
];
