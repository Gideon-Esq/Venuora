"use client";

// 30-minute tour request form → requestTourAction → inline success state.

import * as React from "react";
import Link from "next/link";
import { CalendarCheck2, Loader2 } from "lucide-react";
import { requestTourAction } from "@/actions/public";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

// 30-min slots within reasonable viewing hours (09:00–18:30 local).
const TIME_OPTIONS: string[] = [];
for (let h = 9; h < 19; h++) {
  for (const m of ["00", "30"]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${m}`);
  }
}

function formatSlot(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function TourForm({
  slug,
  brandColor,
  spaces,
}: {
  slug: string;
  brandColor: string;
  spaces: { id: string; name: string }[];
}) {
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    time: "10:00",
    spaceId: "",
    notes: "",
  });
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await requestTourAction(slug, form);
      if (res.ok) setDone(true);
      else setError(res.error);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CalendarCheck2 className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-zinc-900">Tour requested!</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          The venue team will confirm your viewing by email shortly. See you there.
        </p>
        <Link
          href={`/v/${slug}`}
          className="mt-6 inline-flex h-10 items-center rounded-lg px-5 text-sm font-medium text-white shadow-sm"
          style={{ backgroundColor: brandColor }}
        >
          Back to the venue page
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tour-name">Full name</Label>
          <Input
            id="tour-name"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="tour-email">Email</Label>
          <Input
            id="tour-email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="tour-phone">Phone (optional)</Label>
          <Input
            id="tour-phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="tour-space">Space to view (optional)</Label>
          <Select
            id="tour-space"
            value={form.spaceId}
            onChange={(e) => setForm((f) => ({ ...f, spaceId: e.target.value }))}
          >
            <option value="">Whole venue</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="tour-date">Preferred date</Label>
          <Input
            id="tour-date"
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="tour-time">Preferred time</Label>
          <Select
            id="tour-time"
            value={form.time}
            onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {formatSlot(t)}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="tour-notes">Notes (optional)</Label>
          <Textarea
            id="tour-notes"
            placeholder="Tell them about your event — date, guest count, anything useful."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
        style={{ backgroundColor: brandColor }}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Request this tour
      </button>
    </form>
  );
}
