"use client";

// Five-step public booking wizard:
// 1 Date & time → 2 Space → 3 Add-ons → 4 Your details → 5 Review & pay.
// All pricing/availability comes from server actions — nothing is priced
// client-side; the client only orchestrates and displays.

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  Loader2,
  Minus,
  Plus,
  Users,
  Zap,
} from "lucide-react";
import {
  publicDayAvailability,
  publicPriceQuote,
  submitOnlineBookingAction,
} from "@/actions/public";
import { formatMoney } from "@/lib/money";
import { formatInVenueTz } from "@/lib/time";
import { EVENT_TYPE_LABELS, SLOT_TYPE_LABELS } from "@/lib/labels";
import type { CancellationTier } from "@/lib/pricing";
import { cancellationSentences } from "@/components/public/policy-summary";
import { PriceBreakdown } from "@/components/public/price-breakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PhotoOrPlaceholder } from "@/components/public/photo";
import { cn } from "@/lib/utils";

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

interface SlotForm {
  date: string;
  slotType: SlotType;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  guestCount: number;
  eventType: EventType;
}

const SLOT_DEFAULTS: Record<SlotType, { startTime: string; endTime: string }> = {
  HOURLY: { startTime: "10:00", endTime: "14:00" },
  HALF_DAY: { startTime: "09:00", endTime: "14:00" },
  FULL_DAY: { startTime: "09:00", endTime: "21:00" },
  EVENING: { startTime: "18:00", endTime: "23:00" },
};

const STEP_LABELS = ["Date & time", "Space", "Add-ons", "Your details", "Review & pay"];

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
  const [details, setDetails] = React.useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    notes: "",
    termsAccepted: false,
  });

  const [spaceQuotes, setSpaceQuotes] = React.useState<Record<string, QuoteResult>>({});
  const [busy, setBusy] = React.useState<BusyMap>({});
  const [quote, setQuote] = React.useState<QuoteOk | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [quoteLoading, setQuoteLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [outcome, setOutcome] = React.useState<
    | { kind: "inquiry"; manageToken: string }
    | { kind: "redirecting" }
    | { kind: "conflict"; message: string; spaces: string[]; dates: string[] }
    | null
  >(null);
  const requestSeq = React.useRef(0);

  const selectedSpace = spaces.find((s) => s.id === spaceId) ?? null;
  const selections = React.useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, q]) => q > 0)
        .map(([addOnId, quantity]) => ({ addOnId, quantity })),
    [quantities]
  );

  // ---- step 1 → 2: fetch availability + a base quote per space ------------

  function validateStep1(): string | null {
    if (!form.date) return "Pick a date for your event.";
    if (!form.startTime || !form.endTime) return "Set a start and end time.";
    if (!form.endsNextDay && form.endTime <= form.startTime)
      return "End time must be after the start time (or tick “ends next day”).";
    if (form.guestCount < 1) return "How many guests are you expecting?";
    return null;
  }

  async function goToSpaces() {
    const problem = validateStep1();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setLoading(true);
    const seq = ++requestSeq.current;
    try {
      const slotInput = {
        slotType: form.slotType,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        endsNextDay: form.endsNextDay,
        addOns: [],
      };
      const [busyRaw, ...quotes] = await Promise.all([
        publicDayAvailability(venue.slug, form.date),
        ...spaces.map((s) => publicPriceQuote(venue.slug, { ...slotInput, spaceId: s.id })),
      ]);
      if (seq !== requestSeq.current) return;
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
      setStep(2);
    } catch {
      setError("Could not check availability — please try again.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

  // ---- quote refresh (space picked / add-ons changed) ----------------------

  const refreshQuote = React.useCallback(
    async (
      forSpaceId: string,
      sel: { addOnId: string; quantity: number }[]
    ): Promise<QuoteOk | null> => {
      const seq = ++requestSeq.current;
      setQuoteLoading(true);
      try {
        const res = await publicPriceQuote(venue.slug, {
          spaceId: forSpaceId,
          slotType: form.slotType,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          endsNextDay: form.endsNextDay,
          addOns: sel,
        });
        if (seq !== requestSeq.current) return null;
        if (res.ok) {
          setQuote(res);
          setError(null);
          return res;
        }
        setError(res.error);
        return null;
      } catch {
        if (seq === requestSeq.current) setError("Could not update the price — try again.");
        return null;
      } finally {
        if (seq === requestSeq.current) setQuoteLoading(false);
      }
    },
    [venue.slug, form.slotType, form.date, form.startTime, form.endTime, form.endsNextDay]
  );

  function pickSpace(id: string) {
    setSpaceId(id);
    const base = spaceQuotes[id];
    if (base?.ok) setQuote(base);
    setQuantities({});
    setError(null);
    setStep(3);
  }

  function setQuantity(addOn: WizardAddOn, qty: number) {
    const max = addOn.maxQuantity ?? 99;
    const clamped = Math.max(0, Math.min(qty, max));
    const next = { ...quantities, [addOn.id]: clamped };
    setQuantities(next);
    if (spaceId) {
      const sel = Object.entries(next)
        .filter(([, q]) => q > 0)
        .map(([addOnId, quantity]) => ({ addOnId, quantity }));
      void refreshQuote(spaceId, sel);
    }
  }

  // ---- submit ---------------------------------------------------------------

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
        setOutcome({ kind: "redirecting" });
        window.location.href = result.paymentUrl;
        return;
      }
      if (result.ok) {
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

  // ---- terminal outcomes -----------------------------------------------------

  if (outcome?.kind === "redirecting") {
    return (
      <Panel>
        <div className="flex flex-col items-center py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold text-zinc-900">
            Taking you to secure payment…
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Your date is held for 15 minutes while you pay the deposit.
          </p>
        </div>
      </Panel>
    );
  }

  if (outcome?.kind === "inquiry") {
    return (
      <Panel>
        <div className="flex flex-col items-center py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-semibold text-zinc-900">Request sent!</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
            The venue will confirm shortly. We&apos;ve emailed you a link where you can follow
            your booking, pay and manage everything.
          </p>
          <Link
            href={`/b/${outcome.manageToken}`}
            className="mt-6 inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium text-white shadow-sm"
            style={{ backgroundColor: venue.brandColor }}
          >
            View my booking
          </Link>
        </div>
      </Panel>
    );
  }

  if (outcome?.kind === "conflict") {
    return (
      <Panel>
        <div className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">That slot was just booked</h2>
              <p className="mt-1 text-sm text-zinc-600">{outcome.message}</p>
            </div>
          </div>
          {outcome.spaces.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-medium text-zinc-900">
                Other spaces free at your time
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {outcome.spaces.map((name) => (
                  <li key={name}>
                    <Badge className="bg-indigo-50 text-indigo-700">{name}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {outcome.dates.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-medium text-zinc-900">
                Same time on these dates is free
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {outcome.dates.map((iso) => (
                  <li key={iso}>
                    <Badge className="bg-zinc-100 text-zinc-700">
                      {formatInVenueTz(new Date(iso), venue.timezone, "EEE, MMM d yyyy")}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              setOutcome(null);
              setStep(1);
            }}
          >
            Choose another date or space
          </Button>
        </div>
      </Panel>
    );
  }

  // ---- wizard ------------------------------------------------------------------

  return (
    <div>
      <Stepper current={step} />

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      {step === 1 && (
        <Panel>
          <h2 className="text-lg font-semibold text-zinc-900">When is your event?</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bw-date">Date</Label>
              <Input
                id="bw-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="bw-slot">Booking type</Label>
              <Select
                id="bw-slot"
                value={form.slotType}
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
            <div>
              <Label htmlFor="bw-start">Start time</Label>
              <Input
                id="bw-start"
                type="time"
                step={900}
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="bw-end">End time</Label>
              <Input
                id="bw-end"
                type="time"
                step={900}
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={form.endsNextDay}
                  onChange={(e) => setForm((f) => ({ ...f, endsNextDay: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300 accent-indigo-600"
                />
                Ends the next day (past midnight)
              </label>
            </div>
            <div>
              <Label htmlFor="bw-guests">Guest count</Label>
              <Input
                id="bw-guests"
                type="number"
                min={1}
                value={form.guestCount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, guestCount: Math.max(1, Number(e.target.value) || 0) }))
                }
              />
            </div>
            <div>
              <Label htmlFor="bw-event">Event type</Label>
              <Select
                id="bw-event"
                value={form.eventType}
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
          <div className="mt-6 flex justify-end">
            <BrandButton color={venue.brandColor} onClick={goToSpaces} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Check availability
            </BrandButton>
          </div>
        </Panel>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            <CalendarDays className="mr-1 inline h-4 w-4 align-[-2px]" aria-hidden />
            {formatInVenueTz(
              new Date(`${form.date}T12:00:00Z`),
              "UTC",
              "EEE, MMM d yyyy"
            )}{" "}
            · {form.startTime}–{form.endTime}
            {form.endsNextDay ? " (+1 day)" : ""} · {SLOT_TYPE_LABELS[form.slotType]}
          </p>
          {spaces.map((space, idx) => {
            const q = spaceQuotes[space.id];
            const spaceBusy = busy[space.id] ?? [];
            const overCapacity =
              form.guestCount > Math.max(space.seatedCapacity, space.standingCapacity);
            const available = q?.ok ? q.available : false;
            return (
              <Panel key={space.id} className={cn(!q?.ok && "opacity-60")}>
                <div className="flex gap-4">
                  <div className="hidden h-24 w-32 shrink-0 overflow-hidden rounded-xl sm:block">
                    <PhotoOrPlaceholder src={space.photo} alt={`${space.name} photo`} seed={idx + 1} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-zinc-900">{space.name}</h3>
                      {space.instantBook ? (
                        <Badge className="bg-emerald-100 text-emerald-800">
                          <Zap className="mr-1 h-3 w-3" aria-hidden />
                          Instant booking
                        </Badge>
                      ) : (
                        <Badge className="bg-sky-100 text-sky-800">Request to book</Badge>
                      )}
                      {q?.ok &&
                        (available ? (
                          <Badge className="bg-emerald-100 text-emerald-800">
                            Available for your time
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-700">
                            Unavailable for your time
                          </Badge>
                        ))}
                    </div>
                    <p className="mt-1 inline-flex items-center gap-1 text-sm text-zinc-600">
                      <Users className="h-4 w-4" aria-hidden />
                      {space.seatedCapacity} seated · {space.standingCapacity} standing
                      {overCapacity && (
                        <span className="ml-2 text-amber-600">
                          may be tight for {form.guestCount} guests
                        </span>
                      )}
                    </p>
                    {spaceBusy.length > 0 && (
                      <p className="mt-1 text-xs text-zinc-500">
                        Booked that day (incl. setup time):{" "}
                        {spaceBusy
                          .map(
                            (b) =>
                              `${formatInVenueTz(new Date(b.start), venue.timezone, "h:mm a")}–${formatInVenueTz(new Date(b.end), venue.timezone, "h:mm a")}`
                          )
                          .join(", ")}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-3">
                      {q?.ok ? (
                        <p className="text-sm text-zinc-600">
                          Your time:{" "}
                          <span className="text-base font-semibold text-zinc-900">
                            {formatMoney(q.totalCents, venue.currency)}
                          </span>{" "}
                          incl. tax
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-500">
                          {q ? q.error : "Not offered for this booking type"}
                        </p>
                      )}
                      <BrandButton
                        color={venue.brandColor}
                        onClick={() => pickSpace(space.id)}
                        disabled={!q?.ok || !available}
                      >
                        Choose
                      </BrandButton>
                    </div>
                  </div>
                </div>
              </Panel>
            );
          })}
          {spaces.length === 0 && (
            <Panel>
              <p className="text-sm text-zinc-600">
                This venue has no spaces bookable online yet — try{" "}
                <Link href={`/v/${venue.slug}/tour`} className="font-medium text-indigo-600">
                  booking a tour
                </Link>{" "}
                instead.
              </p>
            </Panel>
          )}
          <BackLink onClick={() => setStep(1)} />
        </div>
      )}

      {step === 3 && selectedSpace && (
        <Panel>
          <h2 className="text-lg font-semibold text-zinc-900">Add-ons</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Optional extras from {venue.name}. Your total updates live.
          </p>
          <div className="mt-4 divide-y divide-zinc-100">
            {addOns.length === 0 && (
              <p className="py-3 text-sm text-zinc-500">No add-ons offered — continue straight to your details.</p>
            )}
            {addOns.map((a) => {
              const qty = quantities[a.id] ?? 0;
              return (
                <div key={a.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900">{a.name}</p>
                    {a.description && (
                      <p className="mt-0.5 text-xs text-zinc-500">{a.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-zinc-600">
                      {formatMoney(a.priceCents, venue.currency)}
                      {a.pricingType === "PER_UNIT" ? " each" : " flat"}
                    </p>
                  </div>
                  {a.pricingType === "FLAT" ? (
                    <Button
                      variant={qty > 0 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setQuantity(a, qty > 0 ? 0 : 1)}
                    >
                      {qty > 0 ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden /> Added
                        </>
                      ) : (
                        "Add"
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Fewer ${a.name}`}
                        onClick={() => setQuantity(a, qty - 1)}
                        disabled={qty === 0}
                      >
                        <Minus className="h-4 w-4" aria-hidden />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium tabular-nums">
                        {qty}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`More ${a.name}`}
                        onClick={() => setQuantity(a, qty + 1)}
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3">
            <span className="text-sm font-medium text-zinc-700">Running total</span>
            <span className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900">
              {quoteLoading && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-hidden />}
              {quote ? formatMoney(quote.totalCents, venue.currency) : "—"}
            </span>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <BackLink onClick={() => setStep(2)} />
            <BrandButton color={venue.brandColor} onClick={() => setStep(4)}>
              Continue
            </BrandButton>
          </div>
        </Panel>
      )}

      {step === 4 && (
        <Panel>
          <h2 className="text-lg font-semibold text-zinc-900">Your details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bw-name">Full name</Label>
              <Input
                id="bw-name"
                autoComplete="name"
                required
                value={details.clientName}
                onChange={(e) => setDetails((d) => ({ ...d, clientName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="bw-email">Email</Label>
              <Input
                id="bw-email"
                type="email"
                autoComplete="email"
                required
                value={details.clientEmail}
                onChange={(e) => setDetails((d) => ({ ...d, clientEmail: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="bw-phone">Phone</Label>
              <Input
                id="bw-phone"
                type="tel"
                autoComplete="tel"
                value={details.clientPhone}
                onChange={(e) => setDetails((d) => ({ ...d, clientPhone: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="bw-notes">Notes for the venue (optional)</Label>
              <Textarea
                id="bw-notes"
                placeholder="Anything they should know — timings, suppliers, special requests…"
                value={details.notes}
                onChange={(e) => setDetails((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={details.termsAccepted}
              onChange={(e) => setDetails((d) => ({ ...d, termsAccepted: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-indigo-600"
            />
            <span>
              I agree to the venue&apos;s{" "}
              <Link
                href={`/v/${venue.slug}#policies-heading`}
                target="_blank"
                className="font-medium text-indigo-600 underline-offset-2 hover:underline"
              >
                house rules &amp; policies
              </Link>
              .
            </span>
          </label>
          <div className="mt-6 flex items-center justify-between">
            <BackLink onClick={() => setStep(3)} />
            <BrandButton
              color={venue.brandColor}
              onClick={() => {
                if (!details.clientName.trim() || !details.clientEmail.includes("@")) {
                  setError("Please fill in your name and a valid email.");
                  return;
                }
                if (!details.termsAccepted) {
                  setError("Please accept the venue's house rules and policies to continue.");
                  return;
                }
                setError(null);
                setStep(5);
              }}
            >
              Review booking
            </BrandButton>
          </div>
        </Panel>
      )}

      {step === 5 && selectedSpace && quote && (
        <Panel>
          <h2 className="text-lg font-semibold text-zinc-900">Review &amp; pay</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {selectedSpace.name} ·{" "}
            {formatInVenueTz(new Date(`${form.date}T12:00:00Z`), "UTC", "EEE, MMM d yyyy")} ·{" "}
            {form.startTime}–{form.endTime}
            {form.endsNextDay ? " (+1 day)" : ""} · {form.guestCount} guests
          </p>

          <div className="mt-5">
            <PriceBreakdown
              lineItems={quote.lineItems}
              subtotalCents={quote.subtotalCents}
              taxCents={quote.taxCents}
              totalCents={quote.totalCents}
              currency={venue.currency}
            />
          </div>

          <div className="mt-5 space-y-2 rounded-xl bg-zinc-50 p-4 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-zinc-900">
                Due now: {venue.depositPct}% deposit
              </span>
              <span className="text-lg font-semibold" style={{ color: venue.brandColor }}>
                {formatMoney(quote.depositCents, venue.currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-zinc-600">
              <span>
                Balance due by{" "}
                {formatInVenueTz(new Date(quote.balanceDueDate), venue.timezone, "MMM d, yyyy")}
              </span>
              <span>{formatMoney(quote.totalCents - quote.depositCents, venue.currency)}</span>
            </div>
            {quote.securityDepositCents > 0 && (
              <p className="text-zinc-600">
                A refundable security deposit of{" "}
                <span className="font-medium text-zinc-900">
                  {formatMoney(quote.securityDepositCents, venue.currency)}
                </span>{" "}
                is collected with the balance and returned after your event.
              </p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-zinc-200 p-4">
            <h3 className="text-sm font-medium text-zinc-900">Cancellation policy</h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-zinc-600">
              {cancellationSentences(venue.cancellationTiers).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>

          {!selectedSpace.instantBook && (
            <p className="mt-4 text-sm text-zinc-600">
              This space is <span className="font-medium">request-to-book</span>: the venue will
              confirm your request before any payment is taken.
            </p>
          )}

          <div className="mt-6 flex items-center justify-between">
            <BackLink onClick={() => setStep(4)} />
            <BrandButton
              color={venue.brandColor}
              onClick={submit}
              disabled={submitting || quoteLoading}
              className="h-12 px-6 text-base"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {selectedSpace.instantBook
                ? `Pay ${formatMoney(quote.depositCents, venue.currency)} deposit`
                : "Send booking request"}
            </BrandButton>
          </div>
        </Panel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6", className)}>
      {children}
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-6 flex items-center gap-1.5 overflow-x-auto text-xs sm:gap-2">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "active" : "todo";
        return (
          <li key={label} className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full font-medium",
                state === "done" && "bg-emerald-100 text-emerald-700",
                state === "active" && "bg-indigo-600 text-white",
                state === "todo" && "bg-zinc-100 text-zinc-400"
              )}
            >
              {state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
            </span>
            <span
              className={cn(
                "hidden font-medium sm:inline",
                state === "active" ? "text-zinc-900" : "text-zinc-400"
              )}
            >
              {label}
            </span>
            {n < STEP_LABELS.length && <span className="h-px w-4 bg-zinc-200 sm:w-6" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function BrandButton({
  color,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { color: string }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      style={{ backgroundColor: color }}
    >
      {children}
    </button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden />
      Back
    </button>
  );
}
