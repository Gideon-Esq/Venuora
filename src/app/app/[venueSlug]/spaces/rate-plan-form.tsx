"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { upsertRatePlanAction } from "@/actions/space";

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

export function RatePlanForm({
  slug,
  spaceId,
  initial,
}: {
  slug: string;
  spaceId: string;
  initial: RatePlanFormInitial | null;
}) {
  const router = useRouter();

  const [hourlyRate, setHourlyRate] = React.useState(
    initial ? centsToDollars(initial.hourlyRateCents) : ""
  );
  const [minHours, setMinHours] = React.useState(String(initial?.minBookingHours ?? 2));
  const [overtimeRate, setOvertimeRate] = React.useState(
    centsToDollars(initial?.overtimeHourlyCents ?? null)
  );
  const [eveningStartHour, setEveningStartHour] = React.useState(
    String(initial?.eveningStartHour ?? 17)
  );

  const pkg = (cents: number | null | undefined, hours: number | undefined, defHours: number): PackageState => ({
    offered: cents != null,
    price: centsToDollars(cents ?? null),
    hours: String(hours ?? defHours),
  });
  const [halfDay, setHalfDay] = React.useState<PackageState>(
    pkg(initial?.halfDayCents, initial?.halfDayHours, 5)
  );
  const [fullDay, setFullDay] = React.useState<PackageState>(
    pkg(initial?.fullDayCents, initial?.fullDayHours, 12)
  );
  const [evening, setEvening] = React.useState<PackageState>(
    pkg(initial?.eveningCents, initial?.eveningHours, 6)
  );

  const initDow = initial?.dowMultipliers?.length === 7 ? initial.dowMultipliers : [100, 100, 100, 100, 100, 125, 125];
  const [dow, setDow] = React.useState<string[]>(initDow.map(String));
  const [dowCustom, setDowCustom] = React.useState<boolean[]>(
    initDow.map((v) => !DOW_PRESETS.includes(String(v)))
  );

  const [peaks, setPeaks] = React.useState(
    (initial?.peakPeriods ?? []).map((p) => ({
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      multiplierPct: String(p.multiplierPct),
    }))
  );

  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const hourlyCents = dollarsToCents(hourlyRate);
    if (hourlyCents == null || hourlyCents <= 0) {
      setSaving(false);
      setMessage({ ok: false, text: "Enter an hourly rate — it's the base for all pricing." });
      return;
    }
    const payload = {
      hourlyRateCents: hourlyCents,
      minBookingHours: Number.parseInt(minHours, 10) || 1,
      halfDayCents: halfDay.offered ? dollarsToCents(halfDay.price) : null,
      halfDayHours: Number.parseInt(halfDay.hours, 10) || 5,
      fullDayCents: fullDay.offered ? dollarsToCents(fullDay.price) : null,
      fullDayHours: Number.parseInt(fullDay.hours, 10) || 12,
      eveningCents: evening.offered ? dollarsToCents(evening.price) : null,
      eveningHours: Number.parseInt(evening.hours, 10) || 6,
      eveningStartHour: Number.parseInt(eveningStartHour, 10) || 17,
      overtimeHourlyCents: dollarsToCents(overtimeRate),
      dowMultipliers: dow.map((v) => Number.parseInt(v, 10) || 100),
      peakPeriods: peaks
        .filter((p) => p.name.trim() && p.startDate && p.endDate)
        .map((p) => ({
          name: p.name.trim(),
          startDate: p.startDate,
          endDate: p.endDate,
          multiplierPct: Number.parseInt(p.multiplierPct, 10) || 100,
        })),
    };
    const res = await upsertRatePlanAction(slug, spaceId, payload);
    setSaving(false);
    if (res.ok) {
      setMessage({ ok: true, text: "Rates saved." });
      router.refresh();
    } else {
      setMessage({ ok: false, text: res.error });
    }
  };

  // Plain render function (not a component) so inputs keep focus across renders.
  const renderPackage = (
    label: string,
    hint: string,
    state: PackageState,
    setState: React.Dispatch<React.SetStateAction<PackageState>>
  ) => (
    <div className="rounded-lg border border-zinc-200 p-3">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={state.offered}
          onChange={(e) => setState((s) => ({ ...s, offered: e.target.checked }))}
          className="h-4 w-4 rounded border-zinc-300 accent-indigo-600"
        />
        <span className="text-sm font-medium text-zinc-900">{label}</span>
      </label>
      <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
      {state.offered ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Price</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                $
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={state.price}
                onChange={(e) => setState((s) => ({ ...s, price: e.target.value }))}
                className="pl-7"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Included hours</Label>
            <Input
              type="number"
              min={1}
              max={24}
              value={state.hours}
              onChange={(e) => setState((s) => ({ ...s, hours: e.target.value }))}
            />
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs italic text-zinc-400">Not offered</p>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      {message && (
        <p
          className={
            message.ok
              ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
          }
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="rp-hourly">Hourly rate</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              $
            </span>
            <Input
              id="rp-hourly"
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="pl-7"
              placeholder="150"
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="rp-min">Minimum hours per booking</Label>
          <Input
            id="rp-min"
            type="number"
            min={1}
            max={24}
            value={minHours}
            onChange={(e) => setMinHours(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="rp-overtime">Overtime rate (per extra hour)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              $
            </span>
            <Input
              id="rp-overtime"
              type="number"
              min="0"
              step="0.01"
              value={overtimeRate}
              onChange={(e) => setOvertimeRate(e.target.value)}
              className="pl-7"
              placeholder="Same as hourly"
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Charged when an event runs past its package hours. Leave blank to use the hourly rate.
          </p>
        </div>
      </div>

      <div>
        <Label>Packages</Label>
        <p className="mb-2 text-xs text-zinc-500">
          Fixed prices for common booking lengths. Untick any you don&apos;t offer.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {renderPackage("Half-day", "e.g. morning or afternoon", halfDay, setHalfDay)}
          {renderPackage("Full-day", "the whole day, one price", fullDay, setFullDay)}
          {renderPackage("Evening", "parties and receptions", evening, setEvening)}
        </div>
        {evening.offered && (
          <div className="mt-2 max-w-52">
            <Label htmlFor="rp-evening-start" className="text-xs">
              Evening package starts from (hour, 0–23)
            </Label>
            <Input
              id="rp-evening-start"
              type="number"
              min={0}
              max={23}
              value={eveningStartHour}
              onChange={(e) => setEveningStartHour(e.target.value)}
            />
          </div>
        )}
      </div>

      <div>
        <Label>Day-of-week pricing</Label>
        <p className="mb-2 text-xs text-zinc-500">
          Charge more on busy days — e.g. +25% on Saturdays.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {DOW_NAMES.map((day, i) => (
            <div key={day}>
              <Label className="text-xs">{day}</Label>
              <Select
                value={dowCustom[i] ? "custom" : dow[i]}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "custom") {
                    setDowCustom((c) => c.map((x, j) => (j === i ? true : x)));
                  } else {
                    setDowCustom((c) => c.map((x, j) => (j === i ? false : x)));
                    setDow((d) => d.map((x, j) => (j === i ? v : x)));
                  }
                }}
              >
                <option value="100">Standard</option>
                <option value="110">+10%</option>
                <option value="125">+25%</option>
                <option value="150">+50%</option>
                <option value="custom">Custom…</option>
              </Select>
              {dowCustom[i] && (
                <div className="relative mt-1">
                  <Input
                    type="number"
                    min={25}
                    max={500}
                    value={dow[i]}
                    onChange={(e) => setDow((d) => d.map((x, j) => (j === i ? e.target.value : x)))}
                    className="pr-8"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                    %
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-zinc-400">100% = your normal price.</p>
      </div>

      <div>
        <Label>Peak periods</Label>
        <p className="mb-2 text-xs text-zinc-500">
          Date ranges where prices go up — like December or wedding season. If a date falls in
          two periods, the higher one applies.
        </p>
        <div className="space-y-2">
          {peaks.map((p, i) => (
            <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
              <Input
                value={p.name}
                onChange={(e) =>
                  setPeaks((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                }
                placeholder="e.g. December peak"
                className="col-span-2 sm:col-span-1"
              />
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={p.startDate}
                  onChange={(e) =>
                    setPeaks((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, startDate: e.target.value } : r))
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={p.endDate}
                  onChange={(e) =>
                    setPeaks((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, endDate: e.target.value } : r))
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Multiplier %</Label>
                <div className="relative w-24">
                  <Input
                    type="number"
                    min={25}
                    max={500}
                    value={p.multiplierPct}
                    onChange={(e) =>
                      setPeaks((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, multiplierPct: e.target.value } : r))
                      )
                    }
                    className="pr-7"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                    %
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove peak period"
                onClick={() => setPeaks((rows) => rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4 text-zinc-500" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setPeaks((rows) => [...rows, { name: "", startDate: "", endDate: "", multiplierPct: "125" }])
            }
          >
            <Plus className="h-3.5 w-3.5" /> Add peak period
          </Button>
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save rates"}
      </Button>
    </form>
  );
}
