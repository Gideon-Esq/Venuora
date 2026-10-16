"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calculator, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldHint, Input, Label, Select } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import { priceBooking, type PriceQuote, type RatePlanInput } from "@/lib/pricing";
import { formatInVenueTz } from "@/lib/time";
import { cn } from "@/lib/utils";
import { upsertRatePlanAction } from "@/actions/space";
import { Switch } from "./space-form";

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DOW_PRESETS = ["100", "110", "125", "150"];

export interface RatePlanFormInitial {
  hourlyRateCents: number;
  minBookingHours: number;
  halfDayCents: number | null;
  halfDayHours: number;
  fullDayCents: number | null;
  fullDayHours: number;
  eveningCents: number | null;
  eveningHours: number;
  eveningStartHour: number;
  overtimeHourlyCents: number | null;
  dowMultipliers: number[];
  peakPeriods: { name: string; startDate: string; endDate: string; multiplierPct: number }[];
}

function centsToDollars(cents: number | null): string {
  return cents == null ? "" : (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function dollarsToCents(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

interface PackageState {
  offered: boolean;
  price: string;
  hours: string;
}

interface PeakRow {
  key: number;
  name: string;
  startDate: string;
  endDate: string;
  multiplierPct: string;
}

export interface RateValues {
  hourlyRate: string;
  minHours: string;
  overtimeRate: string;
  eveningStartHour: string;
  halfDay: PackageState;
  fullDay: PackageState;
  evening: PackageState;
  dow: string[];
  dowCustom: boolean[];
  peaks: PeakRow[];
}

type PeakErrors = Partial<Record<"name" | "startDate" | "endDate" | "multiplierPct", string>>;
export interface RateErrors {
  hourlyRate?: string;
  minHours?: string;
  eveningStartHour?: string;
  packages?: Partial<Record<"halfDay" | "fullDay" | "evening", string>>;
  dow?: Record<number, string>;
  peaks?: Record<number, PeakErrors>;
}

let peakKey = 0;

function toValues(initial: RatePlanFormInitial | null): RateValues {
  const pkg = (cents: number | null | undefined, hours: number | undefined, defHours: number): PackageState => ({
    offered: cents != null,
    price: centsToDollars(cents ?? null),
    hours: String(hours ?? defHours),
  });
  const initDow =
    initial?.dowMultipliers?.length === 7 ? initial.dowMultipliers : [100, 100, 100, 100, 100, 125, 125];
  return {
    hourlyRate: initial ? centsToDollars(initial.hourlyRateCents) : "",
    minHours: String(initial?.minBookingHours ?? 2),
    overtimeRate: centsToDollars(initial?.overtimeHourlyCents ?? null),
    eveningStartHour: String(initial?.eveningStartHour ?? 17),
    halfDay: pkg(initial?.halfDayCents, initial?.halfDayHours, 5),
    fullDay: pkg(initial?.fullDayCents, initial?.fullDayHours, 12),
    evening: pkg(initial?.eveningCents, initial?.eveningHours, 6),
    dow: initDow.map(String),
    dowCustom: initDow.map((v) => !DOW_PRESETS.includes(String(v))),
    peaks: (initial?.peakPeriods ?? []).map((p) => ({
      key: ++peakKey,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      multiplierPct: String(p.multiplierPct),
    })),
  };
}

const intIn = (v: string, min: number, max: number) => {
  const n = Number(v);
  return v.trim() !== "" && Number.isInteger(n) && n >= min && n <= max;
};

export function useRatePlanForm(slug: string, spaceId: string, initial: RatePlanFormInitial | null) {
  const [values, setValues] = React.useState<RateValues>(() => toValues(initial));
  const [baseline, setBaseline] = React.useState<RateValues>(values);
  const [errors, setErrors] = React.useState<RateErrors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [openPeaks, setOpenPeaks] = React.useState<Set<number>>(() => new Set());

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);

  const set = React.useCallback(<K extends keyof RateValues>(key: K, v: React.SetStateAction<RateValues[K]>) => {
    setValues((prev) => ({
      ...prev,
      [key]: typeof v === "function" ? (v as (p: RateValues[K]) => RateValues[K])(prev[key]) : v,
    }));
  }, []);

  const validate = (): RateErrors => {
    const e: RateErrors = {};
    const hourlyCents = dollarsToCents(values.hourlyRate);
    if (hourlyCents == null || hourlyCents <= 0) e.hourlyRate = "Enter an hourly rate — it's the base for all pricing.";
    if (values.minHours.trim() !== "" && !intIn(values.minHours, 1, 24)) e.minHours = "Enter 1–24 hours.";
    if (values.evening.offered && values.eveningStartHour.trim() !== "" && !intIn(values.eveningStartHour, 0, 23))
      e.eveningStartHour = "Enter an hour from 0 to 23.";
    const pk: RateErrors["packages"] = {};
    (
      [
        ["halfDay", 12],
        ["fullDay", 24],
        ["evening", 12],
      ] as const
    ).forEach(([k, maxH]) => {
      const p = values[k];
      if (!p.offered) return;
      const c = dollarsToCents(p.price);
      if (c == null || c < 0) pk[k] = "Enter a price, or switch this package off.";
      else if (p.hours.trim() !== "" && !intIn(p.hours, 1, maxH)) pk[k] = `Included hours must be 1–${maxH}.`;
    });
    if (Object.keys(pk).length) e.packages = pk;
    const dowE: Record<number, string> = {};
    values.dow.forEach((v, i) => {
      if (values.dowCustom[i] && !intIn(v, 25, 500)) dowE[i] = "25–500%";
    });
    if (Object.keys(dowE).length) e.dow = dowE;
    const peakE: Record<number, PeakErrors> = {};
    values.peaks.forEach((p) => {
      const pe: PeakErrors = {};
      if (!p.name.trim()) pe.name = "Give this period a name.";
      if (!p.startDate) pe.startDate = "Pick a start date.";
      if (!p.endDate) pe.endDate = "Pick an end date.";
      if (p.startDate && p.endDate && p.startDate > p.endDate) pe.endDate = "End date must be on or after the start date.";
      if (!intIn(p.multiplierPct, 25, 500)) pe.multiplierPct = "Enter 25–500%.";
      if (Object.keys(pe).length) peakE[p.key] = pe;
    });
    if (Object.keys(peakE).length) e.peaks = peakE;
    return e;
  };

  const save = async (): Promise<boolean> => {
    const e = validate();
    setErrors(e);
    setServerError(null);
    if (Object.keys(e).length) {
      if (e.peaks) setOpenPeaks((s) => new Set([...s, ...Object.keys(e.peaks!).map(Number)]));
      return false;
    }
    setSaving(true);
    const payload = {
      hourlyRateCents: dollarsToCents(values.hourlyRate)!,
      minBookingHours: Number.parseInt(values.minHours, 10) || 1,
      halfDayCents: values.halfDay.offered ? dollarsToCents(values.halfDay.price) : null,
      halfDayHours: Number.parseInt(values.halfDay.hours, 10) || 5,
      fullDayCents: values.fullDay.offered ? dollarsToCents(values.fullDay.price) : null,
      fullDayHours: Number.parseInt(values.fullDay.hours, 10) || 12,
      eveningCents: values.evening.offered ? dollarsToCents(values.evening.price) : null,
      eveningHours: Number.parseInt(values.evening.hours, 10) || 6,
      eveningStartHour: Number.parseInt(values.eveningStartHour, 10) || 17,
      overtimeHourlyCents: dollarsToCents(values.overtimeRate),
      dowMultipliers: values.dow.map((v) => Number.parseInt(v, 10) || 100),
      peakPeriods: values.peaks.map((p) => ({
        name: p.name.trim(),
        startDate: p.startDate,
        endDate: p.endDate,
        multiplierPct: Number.parseInt(p.multiplierPct, 10) || 100,
      })),
    };
    try {
      const res = await upsertRatePlanAction(slug, spaceId, payload);
      if (!res.ok) {
        setServerError(res.error);
        return false;
      }
      setBaseline(values);
      return true;
    } catch {
      setServerError("Something went wrong while saving. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setValues(baseline);
    setErrors({});
    setServerError(null);
  };

  return { values, set, errors, serverError, saving, dirty, save, discard, openPeaks, setOpenPeaks };
}

export type RatePlanFormState = ReturnType<typeof useRatePlanForm>;

const RateCurrency = React.createContext("usd");

function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  describedBy,
  suffix,
  className,
  ...rest
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  suffix?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const currency = React.useContext(RateCurrency);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative w-full">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {currency.toUpperCase()}
        </span>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-14 text-right tabular-nums"
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      </div>
      {suffix && <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold tracking-tight text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function shortDate(s: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  // Calendar date only (no instant) — formatted from its parts, so no timezone shift.
  return format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), "MMM d");
}

function peakSummary(p: PeakRow): string {
  const a = shortDate(p.startDate);
  const b = shortDate(p.endDate);
  let range = "Dates not set";
  if (a && b) {
    const [am, ad] = a.split(" ");
    const [bm, bd] = b.split(" ");
    range = a === b ? a : am === bm && p.startDate.slice(0, 4) === p.endDate.slice(0, 4) ? `${am} ${ad}–${bd}` : `${a} – ${b}`;
  } else if (a || b) range = a ? `From ${a}` : `Until ${b}`;
  const pct = Number.parseInt(p.multiplierPct, 10);
  const mult = Number.isFinite(pct) ? `${(pct / 100).toFixed(2).replace(/0$/, "")}×` : "—";
  return `${range} · ${mult}`;
}

export function RatesFields({ form, currency = "usd" }: { form: RatePlanFormState; currency?: string }) {
  return <RateCurrency.Provider value={currency}><RateFieldsContent form={form} /></RateCurrency.Provider>;
}

function RateFieldsContent({ form }: { form: RatePlanFormState }) {
  const { values, set, errors, openPeaks, setOpenPeaks } = form;

  const renderPackage = (
    key: "halfDay" | "fullDay" | "evening",
    label: string,
    hint: string
  ) => {
    const state = values[key];
    const err = errors.packages?.[key];
    const setPkg = (patch: Partial<PackageState>) => set(key, (s) => ({ ...s, ...patch }));
    const id = `rp-${key}`;
    return (
      <li className="rounded-lg border border-border bg-background/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id={`${id}-label`} className="text-sm font-medium text-foreground">
              {label}
            </p>
            <p className="text-[13px] text-muted-foreground">{hint}</p>
          </div>
          <Switch
            checked={state.offered}
            onChange={(v) => setPkg({ offered: v })}
            labelledBy={`${id}-label`}
          />
        </div>
        {state.offered ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
            <div>
              <Label htmlFor={`${id}-price`} className="text-[13px]">
                Price
              </Label>
              <MoneyInput
                id={`${id}-price`}
                value={state.price}
                onChange={(v) => setPkg({ price: v })}
                placeholder="0"
                invalid={!!err}
                describedBy={err ? `${id}-err` : undefined}
              />
            </div>
            <div>
              <Label htmlFor={`${id}-hours`} className="text-[13px]">
                Included hours
              </Label>
              <Input
                id={`${id}-hours`}
                type="number"
                inputMode="numeric"
                min={1}
                max={24}
                value={state.hours}
                onChange={(e) => setPkg({ hours: e.target.value })}
                className="tabular-nums"
              />
            </div>
            {key === "evening" && (
              <div className="col-span-2">
                <Label htmlFor="rp-evening-start" className="text-[13px]">
                  Evening package starts from (hour, 0–23)
                </Label>
                <Input
                  id="rp-evening-start"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={23}
                  value={values.eveningStartHour}
                  onChange={(e) => set("eveningStartHour", e.target.value)}
                  className="max-w-32"
                  aria-invalid={!!errors.eveningStartHour || undefined}
                  aria-describedby="rp-evening-start-hint"
                />
                <FieldHint id="rp-evening-start-hint" error={!!errors.eveningStartHour}>
                  {errors.eveningStartHour ?? "e.g. 17 = 5 PM. Evening bookings can't start earlier."}
                </FieldHint>
              </div>
            )}
            {err && (
              <FieldHint id={`${id}-err`} error className="col-span-2 mt-0">
                {err}
              </FieldHint>
            )}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-muted-foreground">Not offered</p>
        )}
      </li>
    );
  };

  const updatePeak = (key: number, patch: Partial<PeakRow>) =>
    set("peaks", (rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-5">
      <SectionCard title="Base hourly rate" description="Your standard rate before multipliers and add-ons.">
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <Label htmlFor="rp-hourly" className="sm:mt-2.5">
              Hourly rate
            </Label>
            <div className="sm:w-56">
              <MoneyInput
                id="rp-hourly"
                value={values.hourlyRate}
                onChange={(v) => set("hourlyRate", v)}
                placeholder="150"
                suffix="/hour"
                invalid={!!errors.hourlyRate}
                describedBy={errors.hourlyRate ? "rp-hourly-err" : undefined}
              />
            </div>
          </div>
          {errors.hourlyRate && (
            <FieldHint id="rp-hourly-err" error className="-mt-3 sm:text-right">
              {errors.hourlyRate}
            </FieldHint>
          )}
          <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Label htmlFor="rp-min" className="mb-0.5">
                Minimum duration
              </Label>
              <p className="text-[13px] text-muted-foreground">Bookings must be at least this long.</p>
            </div>
            <div className="flex items-center gap-2 sm:w-56">
              <Input
                id="rp-min"
                type="number"
                inputMode="numeric"
                min={1}
                max={24}
                value={values.minHours}
                onChange={(e) => set("minHours", e.target.value)}
                className="text-right tabular-nums"
                aria-invalid={!!errors.minHours || undefined}
                aria-describedby={errors.minHours ? "rp-min-err" : undefined}
              />
              <span className="shrink-0 text-sm text-muted-foreground">hours</span>
            </div>
          </div>
          {errors.minHours && (
            <FieldHint id="rp-min-err" error className="-mt-3 sm:text-right">
              {errors.minHours}
            </FieldHint>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Packages"
        description="Fixed prices for common booking lengths. Switch off any you don't offer."
      >
        <ul className="space-y-3">
          {renderPackage("halfDay", "Half-day", "e.g. morning or afternoon")}
          {renderPackage("fullDay", "Full-day", "The whole day, one price")}
          {renderPackage("evening", "Evening", "Parties and receptions")}
        </ul>
      </SectionCard>

      <SectionCard
        title="Overtime"
        description="Charged per hour when an event runs past its package hours. Leave blank to use the hourly rate."
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <Label htmlFor="rp-overtime" className="sm:mt-2.5">
            Overtime rate
          </Label>
          <div className="sm:w-56">
            <MoneyInput
              id="rp-overtime"
              value={values.overtimeRate}
              onChange={(v) => set("overtimeRate", v)}
              placeholder="Same as hourly"
              suffix="/hour"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Weekday multipliers"
        description="Adjust rates based on the day of the week — e.g. +25% on Saturdays. 100% = your normal price."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DOW_NAMES.map((day, i) => {
            const err = errors.dow?.[i];
            return (
              <div key={day}>
                <Label htmlFor={`rp-dow-${i}`} className="text-[13px]">
                  {day}
                </Label>
                <Select
                  id={`rp-dow-${i}`}
                  value={values.dowCustom[i] ? "custom" : values.dow[i]}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "custom") {
                      set("dowCustom", (c) => c.map((x, j) => (j === i ? true : x)));
                    } else {
                      set("dowCustom", (c) => c.map((x, j) => (j === i ? false : x)));
                      set("dow", (d) => d.map((x, j) => (j === i ? v : x)));
                    }
                  }}
                >
                  <option value="100">Standard</option>
                  <option value="110">+10%</option>
                  <option value="125">+25%</option>
                  <option value="150">+50%</option>
                  <option value="custom">Custom…</option>
                </Select>
                {values.dowCustom[i] && (
                  <>
                    <div className="relative mt-1.5">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={25}
                        max={500}
                        aria-label={`${day} custom percentage`}
                        value={values.dow[i]}
                        onChange={(e) => set("dow", (d) => d.map((x, j) => (j === i ? e.target.value : x)))}
                        className="pr-8 tabular-nums"
                        aria-invalid={!!err || undefined}
                        aria-describedby={err ? `rp-dow-${i}-err` : undefined}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                    {err && (
                      <FieldHint id={`rp-dow-${i}-err`} error>
                        {err}
                      </FieldHint>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Peak periods"
        description="Apply a multiplier during high-demand dates. If a date falls in two periods, the higher one applies."
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const key = ++peakKey;
              set("peaks", (rows) => [...rows, { key, name: "", startDate: "", endDate: "", multiplierPct: "125" }]);
              setOpenPeaks((s) => new Set([...s, key]));
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Add peak period
          </Button>
        }
      >
        {values.peaks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
            No peak periods yet.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {values.peaks.map((p) => {
              const open = openPeaks.has(p.key);
              const pe = errors.peaks?.[p.key];
              const id = `rp-peak-${p.key}`;
              return (
                <li key={p.key}>
                  <h4>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`${id}-panel`}
                      onClick={() =>
                        setOpenPeaks((s) => {
                          const n = new Set(s);
                          if (n.has(p.key)) n.delete(p.key);
                          else n.add(p.key);
                          return n;
                        })
                      }
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {p.name.trim() || "Untitled period"}
                        </span>
                        <span className="block text-[13px] tabular-nums text-muted-foreground">{peakSummary(p)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {pe && <span className="text-xs font-medium text-destructive">Needs fixing</span>}
                        <ChevronDown
                          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
                          aria-hidden
                        />
                      </span>
                    </button>
                  </h4>
                  <div id={`${id}-panel`} hidden={!open} className="border-t border-border bg-background/40 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label htmlFor={`${id}-name`}>Name</Label>
                        <Input
                          id={`${id}-name`}
                          value={p.name}
                          onChange={(e) => updatePeak(p.key, { name: e.target.value })}
                          placeholder="e.g. December peak"
                          aria-invalid={!!pe?.name || undefined}
                          aria-describedby={pe?.name ? `${id}-name-err` : undefined}
                        />
                        {pe?.name && (
                          <FieldHint id={`${id}-name-err`} error>
                            {pe.name}
                          </FieldHint>
                        )}
                      </div>
                      <div>
                        <Label htmlFor={`${id}-from`}>From</Label>
                        <Input
                          id={`${id}-from`}
                          type="date"
                          value={p.startDate}
                          onChange={(e) => updatePeak(p.key, { startDate: e.target.value })}
                          aria-invalid={!!pe?.startDate || undefined}
                          aria-describedby={pe?.startDate ? `${id}-from-err` : undefined}
                        />
                        {pe?.startDate && (
                          <FieldHint id={`${id}-from-err`} error>
                            {pe.startDate}
                          </FieldHint>
                        )}
                      </div>
                      <div>
                        <Label htmlFor={`${id}-to`}>To</Label>
                        <Input
                          id={`${id}-to`}
                          type="date"
                          value={p.endDate}
                          min={p.startDate || undefined}
                          onChange={(e) => updatePeak(p.key, { endDate: e.target.value })}
                          aria-invalid={!!pe?.endDate || undefined}
                          aria-describedby={pe?.endDate ? `${id}-to-err` : undefined}
                        />
                        {pe?.endDate && (
                          <FieldHint id={`${id}-to-err`} error>
                            {pe.endDate}
                          </FieldHint>
                        )}
                      </div>
                      <div>
                        <Label htmlFor={`${id}-mult`}>Multiplier</Label>
                        <div className="relative">
                          <Input
                            id={`${id}-mult`}
                            type="number"
                            inputMode="numeric"
                            min={25}
                            max={500}
                            value={p.multiplierPct}
                            onChange={(e) => updatePeak(p.key, { multiplierPct: e.target.value })}
                            className="pr-8 tabular-nums"
                            aria-invalid={!!pe?.multiplierPct || undefined}
                            aria-describedby={`${id}-mult-hint`}
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                        <FieldHint id={`${id}-mult-hint`} error={!!pe?.multiplierPct}>
                          {pe?.multiplierPct ?? "135% = 1.35× your normal price."}
                        </FieldHint>
                      </div>
                      <div className="flex items-end sm:justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-destructive hover:bg-danger-soft"
                          onClick={() => set("peaks", (rows) => rows.filter((r) => r.key !== p.key))}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden /> Remove period
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function PriceRow({ label, amount, className }: { label: string; amount: string; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{amount}</dd>
    </div>
  );
}

/** Live price preview for a 5-hour hourly booking using the current (unsaved) values. */
export function ExampleBooking({
  values,
  spaceName,
  exampleStart,
  exampleEnd,
  timezone,
  currency,
  taxBps,
  depositNote,
}: {
  values: RateValues;
  spaceName: string;
  exampleStart: string;
  exampleEnd: string;
  timezone: string;
  currency: string;
  taxBps: number;
  depositNote: React.ReactNode;
}) {
  const start = new Date(exampleStart);
  const end = new Date(exampleEnd);
  const hourly = dollarsToCents(values.hourlyRate);

  let body: React.ReactNode;
  if (hourly == null || hourly <= 0) {
    body = <p className="text-sm text-muted-foreground">Enter a base hourly rate to see an example price.</p>;
  } else {
    const rp: RatePlanInput = {
      hourlyRateCents: hourly,
      minBookingHours: Number.parseInt(values.minHours, 10) || 1,
      halfDayCents: null,
      halfDayHours: 5,
      fullDayCents: null,
      fullDayHours: 12,
      eveningCents: null,
      eveningHours: 6,
      overtimeHourlyCents: dollarsToCents(values.overtimeRate),
      dowMultipliers: values.dow.map((v) => Number.parseInt(v, 10) || 100),
      peakPeriods: values.peaks
        .filter((p) => p.startDate && p.endDate && p.startDate <= p.endDate)
        .map((p) => ({
          name: p.name,
          startDate: p.startDate,
          endDate: p.endDate,
          multiplierPct: Number.parseInt(p.multiplierPct, 10) || 100,
        })),
    };
    let q: PriceQuote | null = null;
    try {
      q = priceBooking({
        spaceName,
        ratePlan: rp,
        slotType: "HOURLY",
        start,
        end,
        timezone,
        addOns: [],
        taxBps,
      });
    } catch {
      q = null;
    }
    if (!q) {
      body = <p className="text-sm text-muted-foreground">Fix the highlighted values to see an example price.</p>;
    } else {
      const baseCents = hourly * q.billableHours;
      const effect = q.subtotalCents - baseCents;
      const dowPct = rp.dowMultipliers[6] ?? 100;
      const multLabel = q.multiplierPct !== dowPct ? "Saturday + peak multiplier" : "Saturday multiplier";
      body = (
        <>
          <dl className="space-y-2.5 text-sm text-foreground">
            <PriceRow label={`Base · ${q.billableHours} hours`} amount={formatMoney(baseCents, currency)} />
            {q.multiplierPct !== 100 && (
              <PriceRow
                label={`${multLabel} · ${(q.multiplierPct / 100).toFixed(2).replace(/0$/, "")}×`}
                amount={`${effect < 0 ? "−" : ""}${formatMoney(Math.abs(effect), currency)}`}
              />
            )}
            {taxBps > 0 && <PriceRow label={`Tax · ${taxBps / 100}%`} amount={formatMoney(q.taxCents, currency)} />}
            <div className="border-t border-border pt-3">
              <PriceRow label="Total" amount={formatMoney(q.totalCents, currency)} className="text-base font-semibold" />
            </div>
          </dl>
          {q.billableHours > 5 && (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Billed at your {q.billableHours}-hour minimum duration.
            </p>
          )}
        </>
      );
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-semibold tracking-tight text-foreground">Example booking</h3>
          <p className="text-sm text-muted-foreground">
            {formatInVenueTz(start, timezone, "EEEE, MMM d")} · {formatInVenueTz(start, timezone, "h:mm a")}–
            {formatInVenueTz(end, timezone, "h:mm a")} · 5 hours
          </p>
        </div>
        <Calculator className="h-5 w-5 shrink-0 text-primary" aria-hidden />
      </div>
      <div aria-live="polite">{body}</div>
      <p className="mt-4 text-[13px] text-muted-foreground">This preview updates as values change.</p>
      <p className="mt-3 border-t border-border pt-3 text-[13px] text-muted-foreground">{depositNote}</p>
    </Card>
  );
}
