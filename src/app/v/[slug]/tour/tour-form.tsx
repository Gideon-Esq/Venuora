"use client";

// Tour request form → requestTourAction → inline success state.
// Client-side checks mirror tourRequestSchema so errors show per field; the
// server action stays the source of truth (its errors are shown too).

import * as React from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { requestTourAction } from "@/actions/public";
import { textOnColor } from "@/lib/color";
import { formatInVenueTz, venueLocalToUtc } from "@/lib/time";
import { emailSchema } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";

// 30-minute slots within viewing hours (09:00–18:30, venue-local).
const TIME_OPTIONS: string[] = [];
for (let h = 9; h < 19; h++) {
  for (const m of ["00", "30"]) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${m}`);
}

function formatSlot(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

type FormState = {
  name: string;
  email: string;
  phone: string;
  spaceId: string;
  date: string;
  time: string;
  notes: string;
};
type FieldKey = "name" | "email" | "phone" | "date" | "time" | "notes";
type Errors = Partial<Record<FieldKey, string>>;

const FIELD_ORDER: FieldKey[] = ["name", "email", "phone", "date", "time", "notes"];

function validate(f: FormState, minDate: string): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Please enter your name.";
  else if (f.name.trim().length > 120) e.name = "Please keep your name under 120 characters.";
  if (!emailSchema.safeParse(f.email).success) e.email = "Enter a valid email address.";
  if (f.phone.trim().length > 30) e.phone = "Phone number is too long.";
  if (!f.date) e.date = "Choose a date for your visit.";
  else if (f.date < minDate) e.date = "Choose a date in the future.";
  if (!f.time) e.time = "Choose a time for your visit.";
  if (f.notes.trim().length > 1000) e.notes = "Please keep notes under 1,000 characters.";
  return e;
}

export function TourForm({
  slug,
  venueName,
  brandColor,
  timezone,
  minDate,
  spaces,
}: {
  slug: string;
  venueName: string;
  brandColor: string;
  timezone: string;
  /** Today in the venue's timezone, "YYYY-MM-DD". */
  minDate: string;
  spaces: { id: string; name: string }[];
}) {
  const [form, setForm] = React.useState<FormState>({
    name: "",
    email: "",
    phone: "",
    spaceId: "",
    date: "",
    time: "",
    notes: "",
  });
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<FormState | null>(null);
  const successRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (submitted) successRef.current?.focus();
  }, [submitted]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function focusFirst(errs: Errors) {
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (first) document.getElementById(`tour-${first}`)?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setFormError(null);
    const errs = validate(form, minDate);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      focusFirst(errs);
      return;
    }
    setPending(true);
    try {
      const res = await requestTourAction(slug, form);
      if (res.ok) {
        setSubmitted(form);
      } else if (res.error === "Pick a future time") {
        const next = { time: "That time has already passed — choose a later time." };
        setErrors(next);
        focusFirst(next);
      } else {
        setFormError("We couldn't send your request. Please check your details and try again.");
      }
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    const at =
      submitted.date && submitted.time
        ? venueLocalToUtc(timezone, submitted.date, submitted.time)
        : null;
    const dateLabel = submitted.date
      ? formatInVenueTz(
          venueLocalToUtc(timezone, submitted.date, submitted.time || "12:00"),
          timezone,
          "EEEE, MMMM d, yyyy"
        )
      : "Not selected";
    const timeLabel = at ? formatInVenueTz(at, timezone, "h:mm a") : "Not selected";
    const spaceLabel =
      spaces.find((s) => s.id === submitted.spaceId)?.name ?? "Any available space";

    return (
      <Card className="bg-accent/50 p-6 sm:p-8">
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: brandColor, color: textOnColor(brandColor) }}
        >
          <Check className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <h2
          ref={successRef}
          tabIndex={-1}
          className="mt-5 text-xl font-semibold tracking-tight text-foreground outline-none"
        >
          Tour request received
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground" role="status">
          {venueName} will confirm your time by email.
        </p>
        <dl className="mt-5 space-y-3 rounded-xl border border-border bg-background p-4 text-sm">
          {[
            ["Requested date", dateLabel],
            ["Requested time", timeLabel],
            ["Space", spaceLabel],
          ].map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        <Link
          href={`/v/${slug}`}
          className={cn(buttonVariants({ variant: "outline" }), "mt-5 h-11 w-full text-[15px]")}
        >
          Back to venue
        </Link>
      </Card>
    );
  }

  const fieldProps = (key: FieldKey) => ({
    id: `tour-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `tour-${key}-error` : undefined,
  });
  const fieldError = (key: FieldKey) =>
    errors[key] ? (
      <FieldHint id={`tour-${key}-error`} error>
        {errors[key]}
      </FieldHint>
    ) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request a tour</CardTitle>
        <CardDescription>This is a request, not a confirmed appointment.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate aria-busy={pending}>
          {formError && (
            <p
              role="alert"
              className="mb-5 rounded-lg border border-destructive/30 bg-danger-soft px-3 py-2.5 text-sm text-destructive"
            >
              {formError}
            </p>
          )}
          <div className="space-y-5">
            <div>
              <Label htmlFor="tour-name">Name</Label>
              <Input
                {...fieldProps("name")}
                autoComplete="name"
                className="h-11"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
              {fieldError("name")}
            </div>
            <div>
              <Label htmlFor="tour-email">Email</Label>
              <Input
                {...fieldProps("email")}
                type="email"
                inputMode="email"
                autoComplete="email"
                className="h-11"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
              {fieldError("email")}
            </div>
            <div>
              <Label htmlFor="tour-phone">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                {...fieldProps("phone")}
                type="tel"
                autoComplete="tel"
                placeholder="Your phone number"
                className="h-11"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
              {fieldError("phone")}
            </div>
            {spaces.length > 0 && (
              <div>
                <Label htmlFor="tour-space">
                  Space <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Select
                  id="tour-space"
                  className="h-11"
                  value={form.spaceId}
                  onChange={(e) => set("spaceId", e.target.value)}
                >
                  <option value="">Any available space</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="tour-date">Preferred date</Label>
                <Input
                  {...fieldProps("date")}
                  type="date"
                  min={minDate}
                  className="h-11"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                />
                {fieldError("date")}
              </div>
              <div>
                <Label htmlFor="tour-time">Preferred 30-minute time</Label>
                <Select
                  {...fieldProps("time")}
                  className="h-11"
                  value={form.time}
                  onChange={(e) => set("time", e.target.value)}
                >
                  <option value="" disabled>
                    Choose a time
                  </option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {formatSlot(t)}
                    </option>
                  ))}
                </Select>
                {fieldError("time")}
              </div>
            </div>
            <div>
              <Label htmlFor="tour-notes">Notes</Label>
              <Textarea
                {...fieldProps("notes")}
                placeholder="Tell us anything helpful about your visit"
                rows={4}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
              {fieldError("notes")}
            </div>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-medium shadow-sm transition-[filter,opacity] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-60"
            style={{ backgroundColor: brandColor, color: textOnColor(brandColor) }}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending request...
              </>
            ) : (
              "Request a tour"
            )}
          </button>
          <p className="mt-3 text-center text-sm text-muted-foreground" aria-live="polite">
            {pending ? "Your details are preserved while the request is being sent." : ""}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
