"use client";

// Five-step public booking wizard:
// 1 Date & time → 2 Space → 3 Add-ons → 4 Your details → 5 Review.
// All pricing/availability comes from server actions — nothing is priced
// client-side; the client only orchestrates and displays. Progress is kept
// in sessionStorage (per venue) so a refresh doesn't lose the client's work.

import * as React from "react";
import { DateCalendar } from "./date-calendar";
import { ONLINE_HOLD_MINUTES } from "@/lib/holds";
import Link from "next/link";
import { TriangleAlert as AlertTriangle, Ban, CalendarDays, Check, CircleCheck as CheckCircle2, ChevronRight, Clock, Image as ImageIcon, Loader as Loader2, Lock, Minus, Plus, Sparkles, Zap } from "lucide-react";
import {
  publicDayAvailability,
  publicPriceQuote,
  submitOnlineBookingAction,
} from "@/actions/public";
import { formatMoney } from "@/lib/money";
import { formatInVenueTz, venueDateStr, venueLocalToUtc } from "@/lib/time";
import { EVENT_TYPE_LABELS, SLOT_TYPE_LABELS } from "@/lib/labels";
import { textOnColor } from "@/lib/color";
import type { CancellationTier } from "@/lib/pricing";
import { cancellationSentences } from "@/components/public/policy-summary";
import { PhotoOrPlaceholder } from "@/components/public/photo";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AvailabilitySkeleton,
  BackButton,
  BrandButton,
  Panel,
  PriceUpdating,
  StepActions,
  StepHeading,
  Stepper,
  fmtVenueDate,
  fmtVenueTime,
  tzLabel,
} from "./wizard-ui";

// ---------------------------------------------------------------------------
// Props & local types
// ---------------------------------------------------------------------------

export type SlotType = "HOURLY" | "HALF_DAY" | "FULL_DAY" | "EVENING";
export type EventType =
  | "WEDDING"
  | "BIRTHDAY"
  | "CONFERENCE"
  | "CHURCH_PROGRAM"
  | "CORPORATE"
  | "OTHER";

export interface WizardVenue {
  slug: string;
  name: string;
  brandColor: string;
  currency: string;
  timezone: string;
  depositPct: number;
  balanceDueDays: number;
  securityDepositCents: number;
  cancellationTiers: CancellationTier[];
}

export interface WizardSpace {
  id: string;
  name: string;
  description: string | null;
  photo: string | null;
  seatedCapacity: number;
  standingCapacity: number;
  amenities: string[];
  instantBook: boolean;
  slotTypes: SlotType[];
  minBookingHours: number;
  hourlyRateCents: number | null;
}

export interface WizardAddOn {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  pricingType: "PER_UNIT" | "FLAT";
  maxQuantity: number | null;
}

type QuoteResult = Awaited<ReturnType<typeof publicPriceQuote>>;
type QuoteOk = Extract<QuoteResult, { ok: true }>;
type BusyMap = Record<string, { start: string; end: string }[]>;
type Selection = { addOnId: string; quantity: number };

interface SlotForm {
  date: string;
  slotType: SlotType;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  guestCount: number;
  eventType: EventType;
}

interface Details {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  notes: string;
  termsAccepted: boolean;
}

type Step1Field = "date" | "time" | "guests";
type Step4Field = "name" | "email" | "phone" | "terms";

const SLOT_DEFAULTS: Record<SlotType, { startTime: string; endTime: string }> = {
  HOURLY: { startTime: "10:00", endTime: "14:00" },
  HALF_DAY: { startTime: "09:00", endTime: "14:00" },
  FULL_DAY: { startTime: "09:00", endTime: "21:00" },
  EVENING: { startTime: "18:00", endTime: "23:00" },
};

const SLOT_NOUN: Record<SlotType, string> = {
  HOURLY: "an hourly",
  HALF_DAY: "a half-day",
  FULL_DAY: "a full-day",
  EVENING: "an evening",
};

const EMPTY_DETAILS: Details = {
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  notes: "",
  termsAccepted: false,
};

function toSelections(quantities: Record<string, number>): Selection[] {
  return Object.entries(quantities)
    .filter(([, q]) => q > 0)
    .map(([addOnId, quantity]) => ({ addOnId, quantity }));
}

/** Plain-language reason instead of raw pricing errors. */
function friendlyReason(error: string, slotType: SlotType): string {
  if (/package configured/i.test(error)) return `Not offered as ${SLOT_NOUN[slotType]} booking`;
  if (/rate plan|space unavailable/i.test(error)) return "Not bookable online right now";
  if (/end must be after start/i.test(error)) return "End time must be after the start time";
  return "Not available for these details — try another time or booking type";
}

function validateStep1(form: SlotForm, today: string): { field: Step1Field; message: string }[] {
  const problems: { field: Step1Field; message: string }[] = [];
  if (!form.date) problems.push({ field: "date", message: "Pick a date for your event." });
  else if (form.date < today) problems.push({ field: "date", message: "That date is in the past." });
  if (!form.startTime || !form.endTime)
    problems.push({ field: "time", message: "Set a start and end time." });
  else if (!form.endsNextDay && form.endTime <= form.startTime)
    problems.push({
      field: "time",
      message: "End time must be after the start time (or tick “ends next day”).",
    });
  if (!(form.guestCount >= 1))
    problems.push({ field: "guests", message: "How many guests are you expecting?" });
  else if (form.guestCount > 100_000)
    problems.push({ field: "guests", message: "That's more guests than can be booked online." });
  return problems;
}

function validateStep4(d: Details): Partial<Record<Step4Field, string>> {
  const errs: Partial<Record<Step4Field, string>> = {};
  if (!d.clientName.trim()) errs.name = "Enter your full name.";
  if (!d.clientEmail.includes("@")) errs.email = "Enter a valid email address.";
  const phone = d.clientPhone.trim();
  if (phone && (phone.length < 5 || phone.length > 30))
    errs.phone = "Enter a phone number with at least 5 digits, or leave it empty.";
  if (!d.termsAccepted) errs.terms = "Please accept the venue's house rules and policies to continue.";
  return errs;
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

interface Persisted {
  v: 1;
  prefill: string;
  step: number;
  form: SlotForm;
  spaceId: string | null;
  quantities: Record<string, number>;
  details: Details;
}

function readPersisted(key: string): Persisted | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    return p && p.v === 1 && p.form && p.details ? p : null;
  } catch {
    return null;
  }
}

function writePersisted(key: string, value: Persisted | null) {
  try {
    if (value) window.sessionStorage.setItem(key, JSON.stringify(value));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode, quota) — the wizard still works.
  }
}

// ---------------------------------------------------------------------------

export function BookingWizard({
  venue,
  spaces,
  addOns,
  initialDate,
  initialSpaceId,
}: {
  venue: WizardVenue;
  spaces: WizardSpace[];
  addOns: WizardAddOn[];
  initialDate: string | null;
  initialSpaceId: string | null;
}) {
  const tz = venue.timezone;
  const brand = venue.brandColor;
  const storageKey = `venuora:book:${venue.slug}`;
  const prefillKey = `${initialDate ?? ""}|${initialSpaceId ?? ""}`;

  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState<SlotForm>({
    date: initialDate ?? "",
    slotType: "HOURLY",
    startTime: SLOT_DEFAULTS.HOURLY.startTime,
    endTime: SLOT_DEFAULTS.HOURLY.endTime,
    endsNextDay: false,
    guestCount: 50,
    eventType: "OTHER",
  });
  const [spaceId, setSpaceId] = React.useState<string | null>(initialSpaceId);
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});
  const [details, setDetails] = React.useState<Details>(EMPTY_DETAILS);

  const [spaceQuotes, setSpaceQuotes] = React.useState<Record<string, QuoteResult>>({});
  const [busy, setBusy] = React.useState<BusyMap>({});
  const [quote, setQuote] = React.useState<QuoteOk | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [quoteLoading, setQuoteLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [step1Errors, setStep1Errors] = React.useState<{ field: Step1Field; message: string }[]>([]);
  const [step4Errors, setStep4Errors] = React.useState<Partial<Record<Step4Field, string>>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [dayInfo, setDayInfo] = React.useState<{ date: string; busySpaces: number } | null>(null);
  const [outcome, setOutcome] = React.useState<
    | { kind: "inquiry"; manageToken: string }
    | { kind: "redirecting"; paymentUrl: string; heldUntil: string }
    | { kind: "conflict"; message: string; spaces: string[]; dates: string[] }
    | null
  >(null);
  const requestSeq = React.useRef(0);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);

  const selectedSpace = spaces.find((s) => s.id === spaceId) ?? null;
  const preselectedSpace =
    initialSpaceId && spaceId === initialSpaceId ? (spaces.find((s) => s.id === initialSpaceId) ?? null) : null;
  const selections = React.useMemo(() => toSelections(quantities), [quantities]);
  const zone = tzLabel(tz);

  function go(next: number) {
    setError(null);
    setStep(next);
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }

  // ---- server calls ----------------------------------------------------------

  /** Availability + a base quote per space for the given slot. */
  const loadSpaces = React.useCallback(
    async (f: SlotForm): Promise<boolean> => {
      setError(null);
      setLoading(true);
      const seq = ++requestSeq.current;
      try {
        const slotInput = {
          slotType: f.slotType,
          date: f.date,
          startTime: f.startTime,
          endTime: f.endTime,
          endsNextDay: f.endsNextDay,
          addOns: [],
        };
        const [busyRaw, ...quotes] = await Promise.all([
          publicDayAvailability(venue.slug, f.date),
          ...spaces.map((s) => publicPriceQuote(venue.slug, { ...slotInput, spaceId: s.id })),
        ]);
        if (seq !== requestSeq.current) return false;
        const busyMap: BusyMap = {};
        for (const b of busyRaw) {
          (busyMap[b.spaceId] ??= []).push({ start: b.blockedStart, end: b.blockedEnd });
        }
        setBusy(busyMap);
        const quoteMap: Record<string, QuoteResult> = {};
        spaces.forEach((s, i) => {
          quoteMap[s.id] = quotes[i];
        });
        setSpaceQuotes(quoteMap);
        return true;
      } catch {
        if (seq === requestSeq.current) setError("Could not check availability — please try again.");
        return false;
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [venue.slug, spaces]
  );

  /** Live quote for one space + add-on selection. */
  const fetchQuote = React.useCallback(
    async (f: SlotForm, forSpaceId: string, sel: Selection[]): Promise<QuoteOk | null> => {
      const seq = ++requestSeq.current;
      setQuoteLoading(true);
      try {
        const res = await publicPriceQuote(venue.slug, {
          spaceId: forSpaceId,
          slotType: f.slotType,
          date: f.date,
          startTime: f.startTime,
          endTime: f.endTime,
          endsNextDay: f.endsNextDay,
          addOns: sel,
        });
        if (seq !== requestSeq.current) return null;
        if (res.ok) {
          setQuote(res);
          setError(null);
          return res;
        }
        setError(friendlyReason(res.error, f.slotType));
        return null;
      } catch {
        if (seq === requestSeq.current) setError("Could not update the price — try again.");
        return null;
      } finally {
        if (seq === requestSeq.current) setQuoteLoading(false);
      }
    },
    [venue.slug]
  );

  // ---- restore progress after a refresh -------------------------------------

  React.useEffect(() => {
    let cancelled = false;
    const saved = readPersisted(storageKey);
    const restore = async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!saved || saved.prefill !== prefillKey) {
        setHydrated(true);
        return;
      }
      const validSpace = saved.spaceId && spaces.some((s) => s.id === saved.spaceId) ? saved.spaceId : null;
      const validQty: Record<string, number> = {};
      for (const [id, q] of Object.entries(saved.quantities ?? {})) {
        if (addOns.some((a) => a.id === id) && q > 0) validQty[id] = q;
      }
      setForm(saved.form);
      setSpaceId(validSpace);
      setQuantities(validQty);
      setDetails({ ...EMPTY_DETAILS, ...saved.details });
      setHydrated(true);

      const today = venueDateStr(new Date(), tz);
      if (saved.step < 2 || validateStep1(saved.form, today).length > 0) return;
      const ok = await loadSpaces(saved.form);
      if (cancelled || !ok) return;
      let target = 2;
      if (saved.step >= 3 && validSpace) {
        const q = await fetchQuote(saved.form, validSpace, toSelections(validQty));
        if (cancelled) return;
        if (q) {
          target = 3;
          if (saved.step >= 4) target = 4;
          if (saved.step >= 5 && Object.keys(validateStep4({ ...EMPTY_DETAILS, ...saved.details })).length === 0)
            target = 5;
        }
      }
      setStep(target);
    };
    void restore();
    return () => {
      cancelled = true;
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!hydrated || outcome) return;
    writePersisted(storageKey, {
      v: 1,
      prefill: prefillKey,
      step,
      form,
      spaceId,
      quantities,
      details,
    });
  }, [hydrated, outcome, storageKey, prefillKey, step, form, spaceId, quantities, details]);

  // ---- step 1: day-level availability hint ------------------------------------

  React.useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return;
    const date = form.date;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const raw = await publicDayAvailability(venue.slug, date);
        if (cancelled) return;
        const dayStart = venueLocalToUtc(tz, date, "00:00").getTime();
        const dayEnd = dayStart + 24 * 3_600_000;
        const busyIds = new Set(
          raw
            .filter((b) => new Date(b.blockedStart).getTime() < dayEnd && new Date(b.blockedEnd).getTime() > dayStart)
            .map((b) => b.spaceId)
        );
        setDayInfo({ date, busySpaces: spaces.filter((s) => busyIds.has(s.id)).length });
      } catch {
        // Hint only — failure is silent; the real check runs on Continue.
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.date, venue.slug, tz, spaces]);

  // ---- step transitions ---------------------------------------------------------

  async function goToSpaces() {
    const problems = validateStep1(form, venueDateStr(new Date(), tz));
    setStep1Errors(problems);
    if (problems.length > 0) return;
    const ok = await loadSpaces(form);
    if (ok) go(2);
  }

  async function pickSpace(id: string) {
    const space = spaces.find((s) => s.id === id);
    if (space) {
      const capacity = Math.max(space.seatedCapacity, space.standingCapacity);
      if (capacity > 0 && form.guestCount > capacity) {
        setSpaceId(id);
        setError(`${space.name} fits up to ${capacity} guests, but you entered ${form.guestCount}. Choose a larger space or go back to adjust your guest count.`);
        return;
      }
    }
    setSpaceId(id);
    setError(null);
    const base = spaceQuotes[id];
    if (base?.ok) setQuote(base);
    go(3);
    // Keep the client's add-on picks (venue-wide) and re-price them for this space.
    if (selections.length > 0) void fetchQuote(form, id, selections);
  }

  function setQuantity(addOn: WizardAddOn, qty: number) {
    const max = addOn.maxQuantity ?? 99;
    const clamped = Math.max(0, Math.min(qty, max));
    const next = { ...quantities, [addOn.id]: clamped };
    setQuantities(next);
    if (spaceId) void fetchQuote(form, spaceId, toSelections(next));
  }

  function goToReview() {
    const errs = validateStep4(details);
    setStep4Errors(errs);
    if (errs.name || errs.email) {
      setError("Please fill in your name and a valid email.");
      return;
    }
    if (errs.terms) {
      setError("Please accept the venue's house rules and policies to continue.");
      return;
    }
    if (errs.phone) {
      setError(errs.phone);
      return;
    }
    setError(null);
    go(5);
  }

  // ---- submit -------------------------------------------------------------------

  async function submit() {
    if (!spaceId) return;
    if (!details.termsAccepted) {
      setError("Please accept the venue's house rules and policies to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitOnlineBookingAction(venue.slug, {
        spaceId,
        eventType: form.eventType,
        slotType: form.slotType,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        endsNextDay: form.endsNextDay,
        guestCount: form.guestCount,
        addOns: selections,
        clientName: details.clientName,
        clientEmail: details.clientEmail,
        clientPhone: details.clientPhone,
        notes: details.notes,
        termsAccepted: true,
      });
      if (result.ok && result.mode === "checkout") {
        writePersisted(storageKey, null);
        const heldUntil = result.holdUntil ?? new Date(Date.now() + ONLINE_HOLD_MINUTES * 60_000).toISOString();
        setOutcome({ kind: "redirecting", paymentUrl: result.paymentUrl, heldUntil });
        window.location.href = result.paymentUrl;
        return;
      }
      if (result.ok) {
        writePersisted(storageKey, null);
        setOutcome({ kind: "inquiry", manageToken: result.manageToken });
        return;
      }
      if (result.alternatives) {
        setOutcome({
          kind: "conflict",
          message: result.error,
          spaces: result.alternatives.spaces,
          dates: result.alternatives.dates,
        });
        return;
      }
      setError(result.error);
    } catch {
      setError("Something went wrong submitting your booking — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- conflict recovery ------------------------------------------------------

  async function chooseAltDate(iso: string) {
    const next = { ...form, date: venueDateStr(new Date(iso), tz) };
    setForm(next);
    setOutcome(null);
    setStep(1);
    const ok = await loadSpaces(next);
    if (ok) go(2);
  }

  async function chooseAltSpace(name: string) {
    const target = spaces.find((s) => s.name === name);
    setOutcome(null);
    setStep(1);
    const ok = await loadSpaces(form);
    if (!ok) return;
    if (!target) {
      go(2);
      return;
    }
    setSpaceId(target.id);
    const q = await fetchQuote(form, target.id, selections);
    go(q ? 5 : 2);
  }

  // ---- derived display --------------------------------------------------------

  const timeRange = `${fmtVenueTime(tz, form.date, form.startTime)} – ${fmtVenueTime(tz, form.date, form.endTime)}${
    form.endsNextDay ? " (next day)" : ""
  }`;
  const dateLong = fmtVenueDate(tz, form.date, "EEEE, MMMM d, yyyy");
  const dateShort = fmtVenueDate(tz, form.date, "EEE, MMM d");
  const timeRangeCompact = compactRange(
    fmtVenueTime(tz, form.date, form.startTime),
    fmtVenueTime(tz, form.date, form.endTime)
  );

  // ---- terminal outcomes --------------------------------------------------------

  if (outcome?.kind === "redirecting") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-accent bg-accent/60 p-5 text-accent-foreground sm:p-6">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Your selected time is held while you finish payment
              </h2>
              <p className="mt-1 text-[15px] font-medium text-foreground">
                Held until {formatInVenueTz(new Date(outcome.heldUntil), tz, "h:mm a")} {zone}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your payment page will clearly explain what is due today.
              </p>
            </div>
          </div>
        </div>
        <Panel className="flex flex-col items-center py-8 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
          <p role="status" className="mt-3 text-base font-semibold text-foreground">
            Taking you to secure payment…
          </p>
          <a
            href={outcome.paymentUrl}
            className="mt-3 text-sm font-medium text-foreground underline underline-offset-4"
          >
            Not redirected? Continue to payment
          </a>
        </Panel>
      </div>
    );
  }

  if (outcome?.kind === "inquiry") {
    return (
      <Panel className="flex flex-col items-center py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Request sent</h2>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          {venue.name} will review availability and contact you. No booking is confirmed yet and
          no payment has been taken. We&apos;ve emailed you a link to follow your request.
        </p>
        <Link
          href={`/b/${outcome.manageToken}`}
          className="mt-6 inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold shadow-sm hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          style={{ backgroundColor: brand, color: textOnColor(brand) }}
        >
          View my booking
        </Link>
      </Panel>
    );
  }

  if (outcome?.kind === "conflict") {
    const conflictSpace = selectedSpace;
    return (
      <Panel>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-destructive">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">That time was just taken</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Someone booked it moments ago.{" "}
              {outcome.spaces.length + outcome.dates.length > 0
                ? "Choose one of these available alternatives to continue with your booking."
                : "Choose another date or space to continue."}
            </p>
          </div>
        </div>
        {(outcome.dates.length > 0 || outcome.spaces.length > 0) && (
          <ul className="mt-5 space-y-2">
            {outcome.dates.map((iso) => (
              <li key={iso}>
                <AltRow
                  title={formatInVenueTz(new Date(iso), tz, "EEE, MMM d")}
                  subtitle={`${conflictSpace?.name ?? "Same space"} · same time · ${
                    conflictSpace?.instantBook ? "Instant booking" : "Request to book"
                  }`}
                  onClick={() => void chooseAltDate(iso)}
                />
              </li>
            ))}
            {outcome.spaces.map((name) => {
              const s = spaces.find((x) => x.name === name);
              return (
                <li key={name}>
                  <AltRow
                    title={name}
                    subtitle={`${dateShort} · ${timeRange}${
                      s ? ` · ${s.instantBook ? "Instant booking" : "Request to book"}` : ""
                    }`}
                    onClick={() => void chooseAltSpace(name)}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-5">
          <BackButton
            label="Choose another date or space"
            onClick={() => {
              setOutcome(null);
              go(1);
            }}
          />
        </div>
      </Panel>
    );
  }

  // ---- wizard -------------------------------------------------------------------

  const today = hydrated ? venueDateStr(new Date(), tz) : undefined;
  const fieldErr = (f: Step1Field) => step1Errors.find((p) => p.field === f);

  return (
    <div ref={topRef} className="scroll-mt-4">
      <Stepper current={step} brandColor={brand} onJump={(n) => go(n)} />

      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}

      {/* ---------------- Step 1: date & time ---------------- */}
      {step === 1 && loading && (
        <AvailabilitySkeleton label={`Checking ${dateLong || "your date"}, ${timeRange}…`} />
      )}

      {step === 1 && !loading && (
        <Panel>
          <StepHeading
            ref={headingRef}
            title="Choose your date and time"
            description="Select a date and timing for your event at the venue."
          />

          {preselectedSpace && (
            <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-muted px-3 py-2.5 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
              <span className="text-foreground">
                <span className="font-medium">{preselectedSpace.name}</span> preselected from the
                venue page
              </span>
              <span aria-hidden className="text-muted-foreground">·</span>
              <button
                type="button"
                onClick={() => setSpaceId(null)}
                className="min-h-8 font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                Change
              </button>
            </div>
          )}

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void goToSpaces();
            }}
          >
            <DateCalendar key={form.date.slice(0, 7) || today?.slice(0, 7)} date={form.date} minimum={today} timezone={tz} onChange={(date) => setForm((old) => ({ ...old, date }))} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="bw-date">Selected date</Label>
                <Input
                  id="bw-date"
                  type="date"
                  min={today}
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  aria-invalid={fieldErr("date") ? true : undefined}
                  aria-describedby="bw-date-hint"
                  className="h-11"
                />
                <FieldHint id="bw-date-hint">
                  Times are in {zone}.
                  {form.date && dayInfo?.date === form.date && (
                    <>
                      {" "}
                      {dayInfo.busySpaces === 0
                        ? `No bookings yet on ${fmtVenueDate(tz, form.date, "EEEE")}.`
                        : `${fmtVenueDate(tz, form.date, "EEEE")} availability is partly booked — you'll see free times next.`}
                    </>
                  )}
                  {form.date && dayInfo?.date !== form.date && " Checking that day…"}
                </FieldHint>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="bw-slot">Booking type</Label>
                <Select
                  id="bw-slot"
                  value={form.slotType}
                  className="h-11"
                  onChange={(e) => {
                    const slotType = e.target.value as SlotType;
                    setForm((f) => ({ ...f, slotType, ...SLOT_DEFAULTS[slotType] }));
                  }}
                >
                  {(Object.keys(SLOT_TYPE_LABELS) as SlotType[]).map((st) => (
                    <option key={st} value={st}>
                      {SLOT_TYPE_LABELS[st]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:gap-4">
                <div>
                  <Label htmlFor="bw-start">Start</Label>
                  <Input
                    id="bw-start"
                    type="time"
                    step={900}
                    value={form.startTime}
                    className="h-11"
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    aria-invalid={fieldErr("time") ? true : undefined}
                  />
                </div>
                <div>
                  <Label htmlFor="bw-end">End</Label>
                  <Input
                    id="bw-end"
                    type="time"
                    step={900}
                    value={form.endTime}
                    className="h-11"
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    aria-invalid={fieldErr("time") ? true : undefined}
                  />
                </div>
              </div>
              <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-foreground sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.endsNextDay}
                  onChange={(e) => setForm((f) => ({ ...f, endsNextDay: e.target.checked }))}
                  className="h-5 w-5 rounded border-input"
                  style={{ accentColor: brand }}
                />
                Ends next day (past midnight)
              </label>
              <div>
                <Label htmlFor="bw-guests">Guests</Label>
                <Input
                  id="bw-guests"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.guestCount || ""}
                  className="h-11"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, guestCount: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))
                  }
                  aria-invalid={fieldErr("guests") ? true : undefined}
                />
              </div>
              <div>
                <Label htmlFor="bw-event">Event type</Label>
                <Select
                  id="bw-event"
                  value={form.eventType}
                  className="h-11"
                  onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value as EventType }))}
                >
                  {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((et) => (
                    <option key={et} value={et}>
                      {EVENT_TYPE_LABELS[et]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {step1Errors.length > 0 && (
              <Callout
                tone="danger"
                className="mt-5"
                title={step1Errors.length === 1 ? step1Errors[0].message : "A few details need attention"}
              >
                {step1Errors.length > 1 && (
                  <ul className="list-disc space-y-0.5 pl-4">
                    {step1Errors.map((p) => (
                      <li key={p.message}>{p.message}</li>
                    ))}
                  </ul>
                )}
              </Callout>
            )}

            <StepActions
              primary={
                <BrandButton type="submit" color={brand} loading={loading} disabled={loading}>
                  Continue to spaces
                </BrandButton>
              }
            />
          </form>
        </Panel>
      )}

      {/* ---------------- Step 2: space ---------------- */}
      {step === 2 && (
        <div className="space-y-4">
          <StepHeading
            ref={headingRef}
            title="Choose a space"
            description="Pick the space that best fits your event."
          />
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              {dateShort} · {timeRangeCompact} · {form.guestCount}{" "}
              {form.guestCount === 1 ? "guest" : "guests"}
              {form.slotType !== "HOURLY" && ` · ${SLOT_TYPE_LABELS[form.slotType]}`}
            </span>
          </div>
          {preselectedSpace && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border bg-accent/50 px-4 py-2.5 text-sm">
              <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 text-foreground">
                <span className="font-medium">{preselectedSpace.name}</span> preselected from the venue
                page
              </span>
              <button
                type="button"
                onClick={() => setSpaceId(null)}
                className="min-h-8 font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                Change<span className="sr-only"> space</span>
              </button>
            </div>
          )}
          {spaces.map((space, idx) => (
            <SpaceCard
              key={space.id}
              space={space}
              seed={idx + 1}
              q={spaceQuotes[space.id]}
              busy={busy[space.id] ?? []}
              venue={venue}
              form={form}
              selected={space.id === spaceId}
              onSelect={() => setSpaceId(space.id)}
              onContinue={() => void pickSpace(space.id)}
              onChangeTime={() => go(1)}
            />
          ))}
          {spaces.length === 0 && (
            <Panel>
              <p className="text-sm text-muted-foreground">
                This venue has no spaces bookable online yet — try{" "}
                <Link
                  href={`/v/${venue.slug}/tour`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  booking a tour
                </Link>{" "}
                instead.
              </p>
            </Panel>
          )}
          <BackButton onClick={() => go(1)} label="Change date & time" />
        </div>
      )}

      {/* ---------------- Step 3: add-ons ---------------- */}
      {step === 3 && selectedSpace && (
        <Panel>
          <StepHeading
            ref={headingRef}
            title="Add what you need"
            description={`Optional extras from ${venue.name}. Your total updates as you choose.`}
          />
          {addOns.length === 0 ? (
            <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
              No add-ons offered — continue straight to your details.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {addOns.map((a) => (
                <AddOnRow
                  key={a.id}
                  addOn={a}
                  qty={quantities[a.id] ?? 0}
                  currency={venue.currency}
                  brand={brand}
                  onChange={(q) => setQuantity(a, q)}
                />
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-xl bg-muted px-4 py-3" aria-live="polite">
            {quoteLoading ? (
              <PriceUpdating />
            ) : (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-foreground">
                  Total <span className="font-normal text-muted-foreground">incl. tax</span>
                </span>
                <span className="text-lg font-semibold tabular-nums text-foreground">
                  {quote ? formatMoney(quote.totalCents, venue.currency) : "—"}
                </span>
              </div>
            )}
          </div>
          <StepActions
            back={<BackButton onClick={() => go(2)} />}
            primary={
              <BrandButton color={brand} onClick={() => go(4)} disabled={quoteLoading || !quote}>
                Continue to details
              </BrandButton>
            }
          />
        </Panel>
      )}

      {/* ---------------- Step 4: details ---------------- */}
      {step === 4 && (
        <Panel>
          <StepHeading
            ref={headingRef}
            title="Your details"
            description="So the venue knows who's booking and how to reach you."
          />
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              goToReview();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="bw-name">Full name</Label>
                <Input
                  id="bw-name"
                  autoComplete="name"
                  required
                  className="h-11"
                  value={details.clientName}
                  onChange={(e) => setDetails((d) => ({ ...d, clientName: e.target.value }))}
                  aria-invalid={step4Errors.name ? true : undefined}
                  aria-describedby={step4Errors.name ? "bw-name-err" : undefined}
                />
                {step4Errors.name && (
                  <FieldHint id="bw-name-err" error>
                    {step4Errors.name}
                  </FieldHint>
                )}
              </div>
              <div>
                <Label htmlFor="bw-email">Email</Label>
                <Input
                  id="bw-email"
                  type="email"
                  autoComplete="email"
                  required
                  className="h-11"
                  value={details.clientEmail}
                  onChange={(e) => setDetails((d) => ({ ...d, clientEmail: e.target.value }))}
                  aria-invalid={step4Errors.email ? true : undefined}
                  aria-describedby={step4Errors.email ? "bw-email-err" : "bw-email-hint"}
                />
                {step4Errors.email ? (
                  <FieldHint id="bw-email-err" error>
                    {step4Errors.email}
                  </FieldHint>
                ) : (
                  <FieldHint id="bw-email-hint">Your booking link is sent here.</FieldHint>
                )}
              </div>
              <div>
                <Label htmlFor="bw-phone">
                  Phone <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="bw-phone"
                  type="tel"
                  autoComplete="tel"
                  className="h-11"
                  value={details.clientPhone}
                  onChange={(e) => setDetails((d) => ({ ...d, clientPhone: e.target.value }))}
                  aria-invalid={step4Errors.phone ? true : undefined}
                  aria-describedby={step4Errors.phone ? "bw-phone-err" : undefined}
                />
                {step4Errors.phone && (
                  <FieldHint id="bw-phone-err" error>
                    {step4Errors.phone}
                  </FieldHint>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="bw-notes">
                  Notes for the venue <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="bw-notes"
                  maxLength={2000}
                  placeholder="Anything they should know — timings, suppliers, special requests…"
                  value={details.notes}
                  onChange={(e) => setDetails((d) => ({ ...d, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={details.termsAccepted}
                  onChange={(e) => setDetails((d) => ({ ...d, termsAccepted: e.target.checked }))}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-input"
                  style={{ accentColor: brand }}
                  aria-invalid={step4Errors.terms ? true : undefined}
                  aria-describedby={step4Errors.terms ? "bw-terms-err" : undefined}
                />
                <span>
                  I agree to the venue&apos;s{" "}
                  <Link
                    href={`/v/${venue.slug}#policies-heading`}
                    target="_blank"
                    className="font-medium underline underline-offset-4"
                  >
                    house rules &amp; policies
                    <span className="sr-only"> (opens in a new tab)</span>
                  </Link>
                  .
                </span>
              </label>
              {step4Errors.terms && (
                <FieldHint id="bw-terms-err" error>
                  {step4Errors.terms}
                </FieldHint>
              )}
            </div>
            <StepActions
              back={<BackButton onClick={() => go(3)} />}
              primary={
                <BrandButton type="submit" color={brand}>
                  Review booking
                </BrandButton>
              }
            />
          </form>
        </Panel>
      )}

      {/* ---------------- Step 5: review ---------------- */}
      {step === 5 && selectedSpace && quote && (
        <ReviewStep
          headingRef={headingRef}
          venue={venue}
          space={selectedSpace}
          quote={quote}
          form={form}
          dateLong={dateLong}
          timeRange={timeRange}
          submitting={submitting}
          quoteLoading={quoteLoading}
          onBack={() => go(4)}
          agreed={details.termsAccepted}
          onAgree={(value) => setDetails((old) => ({ ...old, termsAccepted: value }))}
          onSubmit={() => void submit()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step pieces
// ---------------------------------------------------------------------------

/** "5:00 PM", "10:00 PM" → "5:00–10:00 PM" (keeps both meridiems when they differ). */
function compactRange(a: string, b: string): string {
  const ma = a.match(/^(.*) (AM|PM)$/);
  const mb = b.match(/^(.*) (AM|PM)$/);
  if (ma && mb && ma[2] === mb[2]) return `${ma[1]}–${b}`;
  return `${a}–${b}`;
}

function SpaceCard({
  space,
  seed,
  q,
  busy,
  venue,
  form,
  selected,
  onSelect,
  onContinue,
  onChangeTime,
}: {
  space: WizardSpace;
  seed: number;
  q: QuoteResult | undefined;
  busy: { start: string; end: string }[];
  venue: WizardVenue;
  form: SlotForm;
  selected: boolean;
  onSelect: () => void;
  onContinue: () => void;
  onChangeTime: () => void;
}) {
  const tz = venue.timezone;
  const available = q?.ok ? q.available : false;
  const bookable = !!q?.ok && available;
  const isSelected = selected && bookable;
  const overCapacity = form.guestCount > Math.max(space.seatedCapacity, space.standingCapacity);
  const titleId = `space-${space.id}-title`;
  const reasonId = `space-${space.id}-reason`;
  const windows = busy.map((b) =>
    compactRange(
      formatInVenueTz(new Date(b.start), tz, "h:mm a"),
      formatInVenueTz(new Date(b.end), tz, "h:mm a")
    )
  );
  const capacity = [
    space.seatedCapacity > 0 && `${space.seatedCapacity} seated`,
    space.standingCapacity > 0 && `${space.standingCapacity} standing`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "overflow-hidden rounded-xl bg-card shadow-[0_1px_2px_rgba(27,26,34,0.04)]",
        isSelected ? "border-2" : "border border-border",
        !bookable && "bg-muted/40"
      )}
      style={isSelected ? { borderColor: venue.brandColor } : undefined}
    >
      <div className={cn("h-36 w-full bg-muted sm:h-44", !bookable && "opacity-50 grayscale")}>
        {space.photo ? (
          <PhotoOrPlaceholder src={space.photo} alt={`${space.name} photo`} seed={seed} />
        ) : (
          <div
            role="img"
            aria-label={`${space.name} — no photo yet`}
            className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground"
          >
            <ImageIcon className="h-8 w-8 opacity-60" aria-hidden />
          </div>
        )}
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3
            id={titleId}
            className={cn("text-lg font-semibold", bookable ? "text-foreground" : "text-muted-foreground")}
          >
            {space.name}
          </h3>
          {isSelected ? (
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: venue.brandColor, color: textOnColor(venue.brandColor) }}
            >
              <Check className="h-4 w-4" aria-hidden />
              <span className="sr-only">Selected</span>
            </span>
          ) : !bookable ? (
            <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-label="Unavailable" />
          ) : null}
        </div>

        <Badge variant={space.instantBook ? "accent" : "muted"} className="mt-2 text-[13px]">
          {space.instantBook && <Zap aria-hidden />}
          {space.instantBook ? "Instant booking" : "Request to book"}
        </Badge>

        <div id={reasonId} className="mt-3 space-y-1.5 text-sm">
          {!q?.ok ? (
            <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <Ban className="h-4 w-4 shrink-0" aria-hidden />
              {q ? friendlyReason(q.error, form.slotType) : `Not offered as ${SLOT_NOUN[form.slotType]} booking`}
            </p>
          ) : available ? (
            <>
              <p className="flex items-center gap-2 font-medium text-success">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-current" />
                Available
              </p>
              {windows.length > 0 && (
                <p className="text-[13px] text-muted-foreground">
                  Other bookings that day (incl. setup): {windows.join(", ")}
                </p>
              )}
            </>
          ) : (
            <>
              {windows.length > 0 && (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  Partly booked {windows.join(", ")}
                </p>
              )}
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                Not available for the full requested time
              </p>
            </>
          )}
          {capacity && <p className="text-muted-foreground">{capacity}</p>}
          {overCapacity && (
            <p className="flex items-center gap-1.5 text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              May be tight for {form.guestCount} guests
            </p>
          )}
        </div>

        {space.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {space.description}
          </p>
        )}

        {bookable ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-base font-semibold tabular-nums text-foreground">
              {q?.ok && formatMoney(q.totalCents, venue.currency)}
              <span className="ml-1 text-[13px] font-normal text-muted-foreground">total incl. tax</span>
            </p>
            {isSelected ? (
              <BrandButton color={venue.brandColor} onClick={onContinue} aria-describedby={reasonId}>
                Continue
                <span className="sr-only"> with {space.name}</span>
              </BrandButton>
            ) : (
              <button
                type="button"
                onClick={onSelect}
                aria-describedby={reasonId}
                className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              >
                Select space<span className="sr-only"> — {space.name}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {space.hourlyRateCents != null && (
              <p className="text-sm text-muted-foreground">
                From {formatMoney(space.hourlyRateCents, venue.currency)}/hr
              </p>
            )}
            <button
              type="button"
              onClick={onChangeTime}
              className="inline-flex min-h-11 items-center text-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Choose another time
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function AddOnRow({
  addOn: a,
  qty,
  currency,
  brand,
  onChange,
}: {
  addOn: WizardAddOn;
  qty: number;
  currency: string;
  brand: string;
  onChange: (q: number) => void;
}) {
  const max = a.maxQuantity ?? 99;
  const added = qty > 0;
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{a.name}</p>
        {a.description && <p className="mt-0.5 text-[13px] text-muted-foreground">{a.description}</p>}
        <p className="mt-0.5 text-[13px] font-medium text-foreground">
          {formatMoney(a.priceCents, currency)}
          <span className="font-normal text-muted-foreground">
            {a.pricingType === "PER_UNIT" ? " each" : " flat fee"}
          </span>
        </p>
      </div>
      {a.pricingType === "FLAT" ? (
        <button
          type="button"
          aria-pressed={added}
          onClick={() => onChange(added ? 0 : 1)}
          className={cn(
            "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            added ? "border-transparent" : "border-border bg-card text-foreground hover:bg-muted"
          )}
          style={added ? { backgroundColor: brand, color: textOnColor(brand) } : undefined}
        >
          {added ? (
            <>
              <Check className="h-4 w-4" aria-hidden /> Added
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden /> Add
            </>
          )}
          <span className="sr-only"> {a.name}</span>
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`${a.name} quantity`}>
          <button
            type="button"
            aria-label={`Fewer ${a.name}`}
            onClick={() => onChange(qty - 1)}
            disabled={qty === 0}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <output aria-live="polite" className="w-12 text-center text-base font-semibold tabular-nums">
            {qty}
          </output>
          <button
            type="button"
            aria-label={`More ${a.name}`}
            onClick={() => onChange(qty + 1)}
            disabled={qty >= max}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
          {a.maxQuantity != null && qty >= max && (
            <span className="ml-2 text-xs text-muted-foreground">Max {max}</span>
          )}
        </div>
      )}
    </li>
  );
}

function ReviewStep({
  headingRef,
  venue,
  space,
  quote,
  form,
  dateLong,
  timeRange,
  submitting,
  quoteLoading,
  onBack,
  onSubmit,
  agreed,
  onAgree,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  venue: WizardVenue;
  space: WizardSpace;
  quote: QuoteOk;
  form: SlotForm;
  dateLong: string;
  timeRange: string;
  submitting: boolean;
  quoteLoading: boolean;
  onBack: () => void;
  onSubmit: () => void;
  agreed: boolean;
  onAgree: (value: boolean) => void;
}) {
  const instant = space.instantBook;
  const cur = venue.currency;
  const balanceCents = quote.totalCents - quote.depositCents;
  const balanceDate = formatInVenueTz(new Date(quote.balanceDueDate), venue.timezone, "MMM d, yyyy");

  if (!instant) return <div className="space-y-5"><div><p className="text-xs font-medium text-primary">Almost there</p><h2 ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-semibold tracking-tight">Review &amp; request</h2><p className="mt-2 text-sm text-muted-foreground">Check your details before sending your booking request.</p></div><Panel><h3 className="font-semibold">Your request</h3><p className="mt-2 text-sm text-muted-foreground">{dateLong} · {space.name}</p><dl className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">Guests</dt><dd className="mt-1 text-sm font-semibold">{form.guestCount} guests</dd></div><div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">Time</dt><dd className="mt-1 text-sm font-semibold">{timeRange}</dd></div></dl><div className="mt-4 space-y-3 border-t border-border pt-4"><MoneyRow label="Estimated price" value={formatMoney(quote.totalCents, cur)} strong /><MoneyRow label="Add-ons" value={quote.lineItems.some((item) => item.kind === "ADDON") ? `${quote.lineItems.filter((item) => item.kind === "ADDON").length} selected` : "None selected"} /></div></Panel><Callout tone="info">Your request is not confirmed yet. {venue.name} will review the date and contact you.</Callout><section><h3 className="text-base font-semibold">What happens next</h3><ol className="mt-3 space-y-3 rounded-xl border border-border bg-card p-4">{["The venue checks availability for your date.", "The venue sends confirmation or alternatives.", "No payment is taken now."].map((message, index) => <li key={message} className="flex gap-2.5 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-primary">{index + 1}</span>{message}</li>)}</ol></section><label className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm"><input type="checkbox" checked={agreed} onChange={(event) => onAgree(event.target.checked)} className="mt-1 accent-primary" />I agree to {venue.name}’s house rules and cancellation policies.</label><details className="rounded-lg border border-border bg-card p-4 text-sm"><summary className="cursor-pointer font-medium">View policy summary</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">{cancellationSentences(venue.cancellationTiers).map((sentence) => <li key={sentence}>{sentence}</li>)}</ul></details><StepActions back={<BackButton onClick={onBack} />} primary={<BrandButton color={venue.brandColor} loading={submitting} disabled={submitting || quoteLoading || !agreed} onClick={onSubmit}>Send booking request</BrandButton>} /></div>;

  return (
    <Panel>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight text-foreground focus:outline-none"
          >
            {instant ? "Review and secure your date" : "Review & request"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Check your details before confirming your reservation.</p>
        </div>
        {instant ? (
          <Badge variant="accent" className="px-2.5 py-1">
            <CheckCircle2 aria-hidden /> Ready to confirm
          </Badge>
        ) : (
          <Badge variant="muted" className="px-2.5 py-1">
            <Clock aria-hidden /> No payment yet
          </Badge>
        )}
      </div>

      <dl className="grid gap-x-4 gap-y-2 rounded-xl bg-muted px-4 py-3 text-sm sm:grid-cols-2">
        <SummaryItem label="Space" value={space.name} />
        <SummaryItem label="Date" value={dateLong} />
        <SummaryItem label="Time" value={timeRange} />
        <SummaryItem
          label="Guests"
          value={`${form.guestCount} · ${EVENT_TYPE_LABELS[form.eventType]}`}
        />
      </dl>

      <ul className="mt-5 divide-y divide-border text-sm">
        {quote.lineItems.map((li, i) => (
          <li key={i} className="flex items-baseline justify-between gap-4 py-2.5">
            <span className="text-foreground">{li.label}</span>
            <span className="whitespace-nowrap tabular-nums text-foreground">
              {formatMoney(li.totalCents, cur)}
            </span>
          </li>
        ))}
      </ul>
      <div className="space-y-1.5 border-t border-border pt-3 text-sm">
        {quote.taxCents > 0 && (
          <>
            <MoneyRow label="Subtotal" value={formatMoney(quote.subtotalCents, cur)} muted />
            <MoneyRow label="Tax" value={formatMoney(quote.taxCents, cur)} muted />
          </>
        )}
        <div className="flex items-baseline justify-between pt-1 text-base font-semibold text-foreground">
          <span>{instant ? "Total" : "Estimated total"}</span>
          <span className="tabular-nums">{formatMoney(quote.totalCents, cur)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-border px-4 py-3 text-sm">
        <MoneyRow
          label={instant ? `Deposit due now (${venue.depositPct}%)` : `Deposit if confirmed (${venue.depositPct}%)`}
          value={formatMoney(quote.depositCents, cur)}
          strong
        />
        <MoneyRow label={`Balance due ${balanceDate}`} value={formatMoney(balanceCents, cur)} muted />
        {quote.securityDepositCents > 0 && (
          <>
            <MoneyRow
              label="Refundable security deposit"
              value={formatMoney(quote.securityDepositCents, cur)}
              muted
            />
            <p className="text-[13px] text-muted-foreground">
              Collected with the balance and returned after your event.
            </p>
          </>
        )}
      </div>

      <details className="group mt-4 rounded-xl border border-border px-4 py-3 text-sm">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between font-medium text-foreground">
          Cancellation policy
          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          {cancellationSentences(venue.cancellationTiers).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </details>

      {!instant && <section className="mt-5"><h3 className="text-sm font-semibold">What happens next</h3><ol className="mt-3 space-y-3 rounded-xl border border-border p-4 text-sm">{["The venue checks availability for your date.", "The venue sends confirmation or alternatives.", "No payment is taken now."].map((message, index) => <li key={message} className="flex items-start gap-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-primary">{index + 1}</span>{message}</li>)}</ol></section>}
      {instant && <Callout tone="info" className="mt-5">Your selected time is held for {ONLINE_HOLD_MINUTES} minutes once you continue to payment. The booking is confirmed after payment succeeds.</Callout>}
      <p className="mt-4 rounded-lg bg-accent/50 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        {instant
          ? "Payment confirms the booking and secures the date. Cancellation terms are shown before payment."
          : `Send your details to ${venue.name}. The venue will review availability and contact you. No booking is confirmed yet.`}
      </p>

      <StepActions
        back={<BackButton onClick={onBack} />}
        primary={
          <BrandButton
            color={venue.brandColor}
            onClick={onSubmit}
            loading={submitting}
            disabled={submitting || quoteLoading || !agreed}
            className="h-12 px-6 text-base"
          >
            {instant ? `Pay ${formatMoney(quote.depositCents, cur)} deposit` : "Send booking request"}
          </BrandButton>
        }
      />
    </Panel>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4",
        muted && "text-muted-foreground",
        strong && "font-semibold text-foreground"
      )}
    >
      <span>{label}</span>
      <span className="whitespace-nowrap tabular-nums">{value}</span>
    </div>
  );
}

function AltRow({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-[13px] text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}
