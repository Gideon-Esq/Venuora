"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ImageOff, MessageSquare, Plus, Trash2, X, Zap } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { AMENITY_SUGGESTIONS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { upsertSpaceAction } from "@/actions/space";
import { ImageUploader } from "../image-uploader";

const COLOR_PRESETS = [
  { name: "Indigo", value: "#4f46e5" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Slate", value: "#64748b" },
];

export interface SpaceFormInitial {
  name: string;
  description: string;
  seatedCapacity: number;
  standingCapacity: number;
  floorAreaSqm: number | null;
  amenities: string[];
  layouts: { name: string; capacity: number }[];
  photos: string[];
  color: string;
  setupBufferMins: number;
  teardownBufferMins: number;
  instantBook: boolean;
}

const EMPTY: SpaceFormInitial = {
  name: "",
  description: "",
  seatedCapacity: 0,
  standingCapacity: 0,
  floorAreaSqm: null,
  amenities: [],
  layouts: [],
  photos: [],
  color: "#4f46e5",
  setupBufferMins: 60,
  teardownBufferMins: 60,
  instantBook: false,
};

/** Raw (string) form values — kept as typed so inputs behave naturally. */
export interface SpaceValues {
  name: string;
  description: string;
  seated: string;
  standing: string;
  floorArea: string;
  amenities: string[];
  layouts: { name: string; capacity: string }[];
  photos: string[];
  color: string;
  setupBuffer: string;
  teardownBuffer: string;
  instantBook: boolean;
}

function toValues(init: SpaceFormInitial): SpaceValues {
  return {
    name: init.name,
    description: init.description,
    seated: String(init.seatedCapacity),
    standing: String(init.standingCapacity),
    floorArea: init.floorAreaSqm == null ? "" : String(init.floorAreaSqm),
    amenities: init.amenities,
    layouts: init.layouts.map((l) => ({ name: l.name, capacity: String(l.capacity) })),
    photos: init.photos,
    color: init.color,
    setupBuffer: String(init.setupBufferMins),
    teardownBuffer: String(init.teardownBufferMins),
    instantBook: init.instantBook,
  };
}

function isHttpUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export type SpaceErrors = Partial<Record<"name" | "setupBuffer" | "teardownBuffer", string>> & {
  photos?: Record<number, string>;
};

/** Shared state for the space form (used by the create page and the tabbed detail editor). */
export function useSpaceForm(slug: string, spaceId: string | null, initial?: SpaceFormInitial) {
  const [values, setValues] = React.useState<SpaceValues>(() => toValues(initial ?? EMPTY));
  const [baseline, setBaseline] = React.useState<SpaceValues>(values);
  const [errors, setErrors] = React.useState<SpaceErrors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);

  const set = React.useCallback(<K extends keyof SpaceValues>(key: K, v: React.SetStateAction<SpaceValues[K]>) => {
    setValues((prev) => ({
      ...prev,
      [key]: typeof v === "function" ? (v as (p: SpaceValues[K]) => SpaceValues[K])(prev[key]) : v,
    }));
  }, []);

  const validate = (): SpaceErrors => {
    const e: SpaceErrors = {};
    if (!values.name.trim()) e.name = "Give this space a name.";
    const buf = (v: string) => {
      const n = Number.parseInt(v, 10);
      return v.trim() !== "" && (!Number.isFinite(n) || n < 0 || n > 1440);
    };
    if (buf(values.setupBuffer)) e.setupBuffer = "Enter 0–1440 minutes.";
    if (buf(values.teardownBuffer)) e.teardownBuffer = "Enter 0–1440 minutes.";
    const photoErrs: Record<number, string> = {};
    values.photos.forEach((p, i) => {
      if (p.trim() && !isHttpUrl(p.trim())) photoErrs[i] = "Paste a full link starting with https://";
    });
    if (Object.keys(photoErrs).length) e.photos = photoErrs;
    return e;
  };

  /** Validates then saves. Returns the action result, or null when blocked by validation. */
  const save = async () => {
    if (uploading || saving) return null;
    const e = validate();
    setErrors(e);
    setServerError(null);
    if (Object.keys(e).length) return null;
    setSaving(true);
    const payload = {
      name: values.name.trim(),
      description: values.description.trim(),
      seatedCapacity: Number.parseInt(values.seated, 10) || 0,
      standingCapacity: Number.parseInt(values.standing, 10) || 0,
      floorAreaSqm: values.floorArea.trim() === "" ? null : Number.parseInt(values.floorArea, 10) || 0,
      amenities: values.amenities,
      layouts: values.layouts
        .filter((l) => l.name.trim())
        .map((l) => ({ name: l.name.trim(), capacity: Number.parseInt(l.capacity, 10) || 0 })),
      photos: values.photos.map((p) => p.trim()).filter(Boolean),
      color: values.color,
      setupBufferMins: Number.parseInt(values.setupBuffer, 10) || 0,
      teardownBufferMins: Number.parseInt(values.teardownBuffer, 10) || 0,
      instantBook: values.instantBook,
    };
    try {
      const res = await upsertSpaceAction(slug, spaceId, payload);
      if (!res.ok) setServerError(res.error);
      else setBaseline(values);
      return res;
    } catch {
      const msg = "Something went wrong while saving. Please try again.";
      setServerError(msg);
      return { ok: false as const, error: msg };
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (uploading) return;
    setValues(baseline);
    setErrors({});
    setServerError(null);
  };

  return { slug, values, set, errors, serverError, saving, uploading, setUploading, dirty, save, discard };
}

export type SpaceFormState = ReturnType<typeof useSpaceForm>;

function Section({
  title,
  description,
  children,
  as: As = "fieldset",
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  as?: "fieldset" | "section";
}) {
  const Heading = As === "fieldset" ? "legend" : "h2";
  return (
    <As className="min-w-0 space-y-3">
      <Heading className="text-[17px] font-semibold tracking-tight text-foreground">{title}</Heading>
      {description && <p className="-mt-1 text-sm text-muted-foreground">{description}</p>}
      {children}
    </As>
  );
}

const Required = () => (
  <>
    <span aria-hidden className="text-destructive">
      *
    </span>
    <span className="sr-only">(required)</span>
  </>
);

function NameDescriptionFields({ form, createMode }: { form: SpaceFormState; createMode?: boolean }) {
  const { values, set, errors } = form;
  return (
    <>
      <div>
        <Label htmlFor="sp-name">
          Space name
          <Required />
        </Label>
        <Input
          id="sp-name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Main Hall"
          required
          aria-required
          aria-invalid={!!errors.name || undefined}
          aria-describedby={errors.name ? "sp-name-err" : undefined}
        />
        {errors.name && (
          <FieldHint id="sp-name-err" error>
            {errors.name}
          </FieldHint>
        )}
      </div>
      <div>
        <Label htmlFor="sp-desc">Description</Label>
        <Textarea
          id="sp-desc"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder={
            createMode
              ? "Tell guests what makes this space special"
              : "What makes this space great? Natural light, stage, garden view…"
          }
          aria-describedby="sp-desc-hint"
        />
        <FieldHint id="sp-desc-hint">
          Shown to clients. Add helpful details about the layout, light, and best uses.
        </FieldHint>
      </div>
    </>
  );
}

function CapacityFields({ form, withArea }: { form: SpaceFormState; withArea: boolean }) {
  const { values, set } = form;
  return (
    <div className={cn("grid gap-4", withArea ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      <div>
        <Label htmlFor="sp-seated">Seated capacity</Label>
        <Input
          id="sp-seated"
          type="number"
          inputMode="numeric"
          min={0}
          value={values.seated}
          onChange={(e) => set("seated", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="sp-standing">Standing capacity</Label>
        <Input
          id="sp-standing"
          type="number"
          inputMode="numeric"
          min={0}
          value={values.standing}
          onChange={(e) => set("standing", e.target.value)}
        />
      </div>
      {withArea && <FloorAreaField form={form} />}
    </div>
  );
}

function FloorAreaField({ form }: { form: SpaceFormState }) {
  const { values, set } = form;
  return (
    <div>
      <Label htmlFor="sp-area">
        Floor area (m²) <span className="font-normal text-muted-foreground">— optional</span>
      </Label>
      <Input
        id="sp-area"
        type="number"
        inputMode="numeric"
        min={0}
        value={values.floorArea}
        onChange={(e) => set("floorArea", e.target.value)}
        placeholder="e.g. 400"
      />
    </div>
  );
}

function AmenitiesFields({ form }: { form: SpaceFormState }) {
  const { values, set } = form;
  const [customAmenity, setCustomAmenity] = React.useState("");
  const toggleAmenity = (a: string) =>
    set("amenities", (list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));
  const customAmenities = values.amenities.filter((a) => !AMENITY_SUGGESTIONS.includes(a));
  const addCustom = () => {
    const v = customAmenity.trim();
    if (v && !values.amenities.includes(v)) set("amenities", (l) => [...l, v]);
    setCustomAmenity("");
  };
  return (
    <>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {AMENITY_SUGGESTIONS.map((a) => (
          <label
            key={a}
            className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-1 text-sm text-foreground hover:bg-muted/60"
          >
            <input
              type="checkbox"
              checked={values.amenities.includes(a)}
              onChange={() => toggleAmenity(a)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            {a}
          </label>
        ))}
      </div>
      {customAmenities.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Your own amenities">
          {customAmenities.map((a) => (
            <li
              key={a}
              className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pl-3 pr-1 text-xs font-medium text-accent-foreground"
            >
              {a}
              <button
                type="button"
                aria-label={`Remove ${a}`}
                onClick={() => toggleAmenity(a)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-card/70 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex max-w-sm gap-2">
        <Input
          value={customAmenity}
          onChange={(e) => setCustomAmenity(e.target.value)}
          placeholder="Add your own, e.g. Bridal suite"
          aria-label="Add your own amenity"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={addCustom}>
          Add
        </Button>
      </div>
    </>
  );
}

function LayoutsFields({ form }: { form: SpaceFormState }) {
  const { values, set } = form;
  return (
    <div className="space-y-2">
      {values.layouts.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={l.name}
            aria-label={`Layout ${i + 1} name`}
            onChange={(e) =>
              set("layouts", (rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
            }
            placeholder="e.g. Banquet"
            className="flex-1"
          />
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            aria-label={`Layout ${i + 1} capacity`}
            value={l.capacity}
            onChange={(e) =>
              set("layouts", (rows) => rows.map((r, j) => (j === i ? { ...r, capacity: e.target.value } : r)))
            }
            placeholder="Capacity"
            className="w-28"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove layout ${l.name || i + 1}`}
            onClick={() => set("layouts", (rows) => rows.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => set("layouts", (rows) => [...rows, { name: "", capacity: "" }])}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden /> Add layout
      </Button>
    </div>
  );
}

function PhotosFields({ form }: { form: SpaceFormState }) {
  const { values, set, errors } = form;
  return (
    <div className="space-y-3">
      <ImageUploader slug={form.slug} maxFiles={20 - values.photos.length} disabled={form.saving || form.uploading} onBusyChange={form.setUploading} onUpload={urls => set("photos", rows => [...rows, ...urls].slice(0, 20))} />
      {values.photos.length === 0 && <p className="text-sm text-muted-foreground">Upload photos of your space. Your first photo will be the cover.</p>}
      {values.photos.map((p, i) => {
        const err = errors.photos?.[i];
        const ok = p.trim() && isHttpUrl(p.trim());
        return (
          <div key={i} className="flex items-start gap-3">
            <span className="flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {ok ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.trim()} alt={`Photo ${i + 1} preview`} className="h-full w-full object-cover" />
              ) : (
                <ImageOff className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Photo {i + 1}{i === 0 ? " · Cover image" : ""}</p>
              <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-2">Image link</summary>
              <Input
                value={p}
                type="url"
                aria-label={`Photo ${i + 1} link`}
                onChange={(e) => set("photos", (rows) => rows.map((r, j) => (j === i ? e.target.value : r)))}
                placeholder="https://…"
                aria-invalid={!!err || undefined}
                aria-describedby={err ? `sp-photo-${i}-err` : undefined}
              />
              {err && (
                <FieldHint id={`sp-photo-${i}-err`} error>
                  {err}
                </FieldHint>
              )}
              </details>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={form.uploading}
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => set("photos", (rows) => rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden />
            </Button>
          </div>
        );
      })}

    </div>
  );
}

function ColorField({ form }: { form: SpaceFormState }) {
  const { values, set } = form;
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Calendar colour">
      {COLOR_PRESETS.map((c) => {
        const selected = values.color.toLowerCase() === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={c.name}
            aria-label={c.name}
            onClick={() => set("color", c.value)}
            className="flex h-10 w-10 items-center justify-center rounded-full transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            style={{
              backgroundColor: c.value,
              boxShadow: selected ? `0 0 0 2px var(--card), 0 0 0 4px ${c.value}` : undefined,
            }}
          >
            {selected && <Check className="h-4 w-4 text-white" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/** Name, description, capacities, amenities, layouts, photos, calendar colour (detail editor). */
export function SpaceDetailsFields({ form }: { form: SpaceFormState }) {
  return (
    <div className="space-y-8">
      <Section title="Basics">
        <NameDescriptionFields form={form} />
        <CapacityFields form={form} withArea />
      </Section>
      <Section title="Amenities" description="Tick what's available. Clients see these on your public page.">
        <AmenitiesFields form={form} />
      </Section>
      <Section title="Layouts" description="How the room can be arranged, with the capacity for each.">
        <LayoutsFields form={form} />
      </Section>
      <Section title="Photos" description="Upload up to 20 photos. The first photo is used as the cover.">
        <PhotosFields form={form} />
      </Section>
      <Section title="Calendar colour" description="Bookings for this space show in this colour on your calendar.">
        <ColorField form={form} />
      </Section>
    </div>
  );
}

/** Setup/teardown buffers and instant book. */
export function SpaceAvailabilityFields({ form }: { form: SpaceFormState }) {
  const { values, set, errors } = form;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sp-setup">Setup buffer (minutes before)</Label>
          <Input
            id="sp-setup"
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            value={values.setupBuffer}
            onChange={(e) => set("setupBuffer", e.target.value)}
            aria-invalid={!!errors.setupBuffer || undefined}
            aria-describedby="sp-setup-hint"
          />
          <FieldHint id="sp-setup-hint" error={!!errors.setupBuffer}>
            {errors.setupBuffer ?? "Time you block before each event for setup — clients get access from then."}
          </FieldHint>
        </div>
        <div>
          <Label htmlFor="sp-teardown">Teardown buffer (minutes after)</Label>
          <Input
            id="sp-teardown"
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            value={values.teardownBuffer}
            onChange={(e) => set("teardownBuffer", e.target.value)}
            aria-invalid={!!errors.teardownBuffer || undefined}
            aria-describedby="sp-teardown-hint"
          />
          <FieldHint id="sp-teardown-hint" error={!!errors.teardownBuffer}>
            {errors.teardownBuffer ?? "Time blocked after each event for cleanup before the next booking."}
          </FieldHint>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <p id="sp-instant-label" className="text-sm font-medium text-foreground">
            Instant book
          </p>
          <p id="sp-instant-desc" className="mt-0.5 text-[13px] text-muted-foreground">
            Instant book lets clients pay online without approval; otherwise you approve inquiries first.
          </p>
        </div>
        <Switch
          checked={values.instantBook}
          onChange={(v) => set("instantBook", v)}
          labelledBy="sp-instant-label"
          describedBy="sp-instant-desc"
        />
      </div>
    </div>
  );
}

/** Accessible on/off switch (button role="switch"), with visible On/Off text. */
export function Switch({
  checked,
  onChange,
  label,
  labelledBy,
  describedBy,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className="group inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="w-6 text-right text-xs font-medium text-muted-foreground" aria-hidden>
        {checked ? "On" : "Off"}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

const BUFFER_OPTIONS = [0, 15, 30, 45, 60, 90, 120];

function BufferSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const current = Number.parseInt(value, 10) || 0;
  const options = BUFFER_OPTIONS.includes(current)
    ? BUFFER_OPTIONS
    : [...BUFFER_OPTIONS, current].sort((a, b) => a - b);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={String(current)} onChange={(e) => onChange(e.target.value)}>
        {options.map((m) => (
          <option key={m} value={m}>
            {m === 0 ? "None" : `${m} minutes`}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Two-option segmented control for booking mode. */
function BookingModeControl({ form }: { form: SpaceFormState }) {
  const { values, set } = form;
  const opts = [
    { v: false, label: "Request to book", icon: MessageSquare },
    { v: true, label: "Instant booking", icon: Zap },
  ];
  return (
    <div>
      <p id="sp-mode-label" className="mb-1.5 text-sm font-medium text-foreground">
        Booking mode
      </p>
      <div
        role="radiogroup"
        aria-labelledby="sp-mode-label"
        aria-describedby="sp-mode-hint"
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
            e.preventDefault();
            const group = e.currentTarget;
            set("instantBook", (v) => !v);
            requestAnimationFrame(() =>
              group.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
            );
          }
        }}
      >
        {opts.map((o) => {
          const selected = values.instantBook === o.v;
          const Icon = o.icon;
          return (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => set("instantBook", o.v)}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {o.label}
            </button>
          );
        })}
      </div>
      <FieldHint id="sp-mode-hint">
        {values.instantBook
          ? "Clients can pay online and confirm straight away, without your approval."
          : "Clients send a request; you approve it before any payment is taken."}
      </FieldHint>
    </div>
  );
}

/** Stand-alone create form used by /spaces/new. */
export function SpaceForm({
  slug,
  spaceId,
  initial,
  canManageBilling = false,
}: {
  slug: string;
  spaceId: string | null;
  initial?: SpaceFormInitial;
  canManageBilling?: boolean;
}) {
  const router = useRouter();
  const form = useSpaceForm(slug, spaceId, initial);
  const isPlanLimit = !!form.serverError && /plan allows up to/i.test(form.serverError);
  const errorRef = React.useRef<HTMLDivElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await form.save();
    if (!res || !res.ok) {
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    if (!spaceId && "spaceId" in res) {
      router.push(`/app/${slug}/spaces/${res.spaceId}?tab=rates`);
    }
    router.refresh();
  };

  const hasFieldErrors = Object.keys(form.errors).length > 0;

  return (
    <form onSubmit={submit} noValidate className="space-y-10">
      <div ref={errorRef} className="space-y-3 empty:hidden">
        {form.serverError &&
          (isPlanLimit ? (
            <Callout
              tone="danger"
              title="No space was created."
            >
              <p>Your current plan has reached its space limit.</p>
              {canManageBilling ? (
                <Link
                  href={`/app/${slug}/settings/billing`}
                  className="mt-1 inline-flex min-h-10 items-center font-semibold text-primary underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  View Billing
                </Link>
              ) : (
                <p className="mt-1">Ask the venue owner to upgrade the plan.</p>
              )}
            </Callout>
          ) : (
            <Callout tone="danger" title="No space was created.">
              {form.serverError}
            </Callout>
          ))}
        {hasFieldErrors && <Callout tone="danger">Please fix the highlighted fields below.</Callout>}
      </div>

      <Section as="section" title="Basics">
        <NameDescriptionFields form={form} createMode />
      </Section>

      <Section as="section" title="Photos">
        <PhotosFields form={form} />
      </Section>

      <Section as="section" title="Capacity">
        <CapacityFields form={form} withArea={false} />
      </Section>

      <Section as="section" title="Booking setup">
        <BookingModeControl form={form} />
        <div className="grid grid-cols-2 gap-3">
          <BufferSelect
            id="sp-setup"
            label="Setup duration"
            value={form.values.setupBuffer}
            onChange={(v) => form.set("setupBuffer", v)}
          />
          <BufferSelect
            id="sp-teardown"
            label="Teardown duration"
            value={form.values.teardownBuffer}
            onChange={(v) => form.set("teardownBuffer", v)}
          />
        </div>
        <FieldHint className="-mt-1">
          Time blocked before and after each event for setup and cleanup, so bookings never run back to back.
        </FieldHint>
      </Section>

      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-[15px] font-semibold text-foreground">More details</span>
            <span className="block text-[13px] text-muted-foreground">
              Floor area, amenities, layouts and calendar colour — optional
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-8 border-t border-border px-4 py-5">
          <div className="sm:max-w-xs">
            <FloorAreaField form={form} />
          </div>
          <Section title="Amenities" description="Tick what's available. Clients see these on your public page.">
            <AmenitiesFields form={form} />
          </Section>
          <Section title="Layouts" description="How the room can be arranged, with the capacity for each.">
            <LayoutsFields form={form} />
          </Section>
          <Section title="Calendar colour" description="Bookings for this space show in this colour on your calendar.">
            <ColorField form={form} />
          </Section>
        </div>
      </details>

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-card sm:px-4 sm:shadow-lg">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
          <Link href={`/app/${slug}/spaces`} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Cancel
          </Link>
          <Button type="submit" size="lg" disabled={form.saving || form.uploading}>
            {form.uploading ? "Uploading…" : form.saving ? "Saving…" : spaceId ? "Save space" : "Create space"}
          </Button>
        </div>
      </div>
    </form>
  );
}
