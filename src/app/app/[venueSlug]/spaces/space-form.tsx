"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { AMENITY_SUGGESTIONS } from "@/lib/labels";
import { upsertSpaceAction } from "@/actions/space";

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

export function SpaceForm({
  slug,
  spaceId,
  initial,
}: {
  slug: string;
  spaceId: string | null;
  initial?: SpaceFormInitial;
}) {
  const router = useRouter();
  const init = initial ?? EMPTY;

  const [name, setName] = React.useState(init.name);
  const [description, setDescription] = React.useState(init.description);
  const [seated, setSeated] = React.useState(String(init.seatedCapacity));
  const [standing, setStanding] = React.useState(String(init.standingCapacity));
  const [floorArea, setFloorArea] = React.useState(
    init.floorAreaSqm == null ? "" : String(init.floorAreaSqm)
  );
  const [amenities, setAmenities] = React.useState<string[]>(init.amenities);
  const [customAmenity, setCustomAmenity] = React.useState("");
  const [layouts, setLayouts] = React.useState(
    init.layouts.map((l) => ({ name: l.name, capacity: String(l.capacity) }))
  );
  const [photos, setPhotos] = React.useState<string[]>(init.photos);
  const [color, setColor] = React.useState(init.color);
  const [setupBuffer, setSetupBuffer] = React.useState(String(init.setupBufferMins));
  const [teardownBuffer, setTeardownBuffer] = React.useState(String(init.teardownBufferMins));
  const [instantBook, setInstantBook] = React.useState(init.instantBook);

  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const toggleAmenity = (a: string) =>
    setAmenities((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));

  const customAmenities = amenities.filter((a) => !AMENITY_SUGGESTIONS.includes(a));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      seatedCapacity: Number.parseInt(seated, 10) || 0,
      standingCapacity: Number.parseInt(standing, 10) || 0,
      floorAreaSqm: floorArea.trim() === "" ? null : Number.parseInt(floorArea, 10) || 0,
      amenities,
      layouts: layouts
        .filter((l) => l.name.trim())
        .map((l) => ({ name: l.name.trim(), capacity: Number.parseInt(l.capacity, 10) || 0 })),
      photos: photos.map((p) => p.trim()).filter(Boolean),
      color,
      setupBufferMins: Number.parseInt(setupBuffer, 10) || 0,
      teardownBufferMins: Number.parseInt(teardownBuffer, 10) || 0,
      instantBook,
    };
    const res = await upsertSpaceAction(slug, spaceId, payload);
    setSaving(false);
    if (!res.ok) {
      setMessage({ ok: false, text: res.error });
      return;
    }
    if (!spaceId) {
      router.push(`/app/${slug}/spaces/${res.spaceId}`);
      router.refresh();
    } else {
      setMessage({ ok: true, text: "Space saved." });
      router.refresh();
    }
  };

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

      <div>
        <Label htmlFor="sp-name">Space name</Label>
        <Input
          id="sp-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Main Hall"
          required
        />
      </div>

      <div>
        <Label htmlFor="sp-desc">Description (shown to clients)</Label>
        <Textarea
          id="sp-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What makes this space great? Natural light, stage, garden view…"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="sp-seated">Seated capacity</Label>
          <Input
            id="sp-seated"
            type="number"
            min={0}
            value={seated}
            onChange={(e) => setSeated(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="sp-standing">Standing capacity</Label>
          <Input
            id="sp-standing"
            type="number"
            min={0}
            value={standing}
            onChange={(e) => setStanding(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="sp-area">Floor area (m²) — optional</Label>
          <Input
            id="sp-area"
            type="number"
            min={0}
            value={floorArea}
            onChange={(e) => setFloorArea(e.target.value)}
            placeholder="e.g. 400"
          />
        </div>
      </div>

      <div>
        <Label>Amenities</Label>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {AMENITY_SUGGESTIONS.map((a) => (
            <label key={a} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={amenities.includes(a)}
                onChange={() => toggleAmenity(a)}
                className="h-4 w-4 rounded border-zinc-300 accent-indigo-600"
              />
              {a}
            </label>
          ))}
        </div>
        {customAmenities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {customAmenities.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700"
              >
                {a}
                <button
                  type="button"
                  aria-label={`Remove ${a}`}
                  onClick={() => toggleAmenity(a)}
                  className="text-indigo-400 hover:text-indigo-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex max-w-sm gap-2">
          <Input
            value={customAmenity}
            onChange={(e) => setCustomAmenity(e.target.value)}
            placeholder="Add your own, e.g. Bridal suite"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = customAmenity.trim();
                if (v && !amenities.includes(v)) setAmenities((l) => [...l, v]);
                setCustomAmenity("");
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const v = customAmenity.trim();
              if (v && !amenities.includes(v)) setAmenities((l) => [...l, v]);
              setCustomAmenity("");
            }}
          >
            Add
          </Button>
        </div>
      </div>

      <div>
        <Label>Layouts (how the room can be arranged)</Label>
        <div className="space-y-2">
          {layouts.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={l.name}
                onChange={(e) =>
                  setLayouts((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                }
                placeholder="e.g. Banquet"
                className="flex-1"
              />
              <Input
                type="number"
                min={0}
                value={l.capacity}
                onChange={(e) =>
                  setLayouts((rows) =>
                    rows.map((r, j) => (j === i ? { ...r, capacity: e.target.value } : r))
                  )
                }
                placeholder="Capacity"
                className="w-28"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove layout"
                onClick={() => setLayouts((rows) => rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4 text-zinc-500" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLayouts((rows) => [...rows, { name: "", capacity: "" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Add layout
          </Button>
        </div>
      </div>

      <div>
        <Label>Photos (paste image URLs)</Label>
        <div className="space-y-2">
          {photos.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={p}
                onChange={(e) =>
                  setPhotos((rows) => rows.map((r, j) => (j === i ? e.target.value : r)))
                }
                placeholder="https://…"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove photo"
                onClick={() => setPhotos((rows) => rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4 text-zinc-500" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPhotos((rows) => [...rows, ""])}
          >
            <Plus className="h-3.5 w-3.5" /> Add photo URL
          </Button>
        </div>
      </div>

      <div>
        <Label>Calendar color</Label>
        <p className="mb-2 text-xs text-zinc-500">
          Bookings for this space show in this color on your calendar.
        </p>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.name}
              aria-label={`Color ${c.name}`}
              onClick={() => setColor(c.value)}
              className="flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-indigo-600"
              style={{
                backgroundColor: c.value,
                boxShadow: color === c.value ? `0 0 0 2px white, 0 0 0 4px ${c.value}` : undefined,
              }}
            >
              {color === c.value && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sp-setup">Setup buffer (minutes before)</Label>
          <Input
            id="sp-setup"
            type="number"
            min={0}
            max={1440}
            value={setupBuffer}
            onChange={(e) => setSetupBuffer(e.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Time you block before each event for setup — clients get access from then.
          </p>
        </div>
        <div>
          <Label htmlFor="sp-teardown">Teardown buffer (minutes after)</Label>
          <Input
            id="sp-teardown"
            type="number"
            min={0}
            max={1440}
            value={teardownBuffer}
            onChange={(e) => setTeardownBuffer(e.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Time blocked after each event for cleanup before the next booking.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3">
        <input
          type="checkbox"
          checked={instantBook}
          onChange={(e) => setInstantBook(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-indigo-600"
        />
        <span>
          <span className="block text-sm font-medium text-zinc-900">Instant book</span>
          <span className="block text-xs text-zinc-500">
            Instant book lets clients pay online without approval; otherwise you approve
            inquiries first.
          </span>
        </span>
      </label>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : spaceId ? "Save space" : "Create space"}
      </Button>
    </form>
  );
}
