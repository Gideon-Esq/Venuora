"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { updateBrandingAction } from "@/actions/venue";

export interface BrandingInitial {
  brandColor: string;
  logoUrl: string;
  photos: string[];
}

const COLOR_PRESETS = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#0f766e",
  "#1e293b",
];

export function BrandingForm({
  slug,
  venueName,
  initial,
}: {
  slug: string;
  venueName: string;
  initial: BrandingInitial;
}) {
  const router = useRouter();
  const [brandColor, setBrandColor] = React.useState(initial.brandColor);
  const [logoUrl, setLogoUrl] = React.useState(initial.logoUrl);
  const [photos, setPhotos] = React.useState<string[]>(initial.photos);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const validColor = /^#[0-9a-fA-F]{6}$/.test(brandColor);

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        const res = await updateBrandingAction(slug, {
          brandColor,
          logoUrl: logoUrl.trim(),
          photos: photos.map((p) => p.trim()).filter(Boolean),
        });
        setSaving(false);
        if (res.ok) {
          setMessage({ ok: true, text: "Branding saved." });
          router.refresh();
        } else {
          setMessage({ ok: false, text: res.error });
        }
      }}
    >
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
        <Label>Brand color</Label>
        <p className="mb-2 text-xs text-zinc-500">
          Used on your public page, quotes and client emails.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Use color ${c}`}
              onClick={() => setBrandColor(c)}
              className="h-8 w-8 rounded-full transition hover:scale-110"
              style={{
                backgroundColor: c,
                boxShadow:
                  brandColor.toLowerCase() === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
              }}
            />
          ))}
          <input
            type="color"
            value={validColor ? brandColor : "#4f46e5"}
            onChange={(e) => setBrandColor(e.target.value)}
            aria-label="Pick a custom color"
            className="h-9 w-9 cursor-pointer rounded border border-zinc-300 bg-white p-0.5"
          />
          <Input
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="w-28 font-mono text-xs"
            aria-label="Hex color"
          />
        </div>
        {!validColor && (
          <p className="mt-1 text-xs text-rose-600">Use a 6-digit hex color like #4f46e5.</p>
        )}
      </div>

      {/* Live preview */}
      <div>
        <Label>Preview</Label>
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ backgroundColor: validColor ? brandColor : "#4f46e5" }}
          >
            {logoUrl.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo preview" className="h-8 w-8 rounded bg-white/90 object-contain p-0.5" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded bg-white/90 text-sm font-bold" style={{ color: validColor ? brandColor : "#4f46e5" }}>
                {venueName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="font-semibold text-white">{venueName}</span>
          </div>
          <div className="flex items-center justify-between bg-white px-4 py-3">
            <span className="text-sm text-zinc-600">This is how clients see your brand.</span>
            <span
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
              style={{ backgroundColor: validColor ? brandColor : "#4f46e5" }}
            >
              Book now
            </span>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="brand-logo">Logo URL</Label>
        <Input
          id="brand-logo"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://…/logo.png"
        />
      </div>

      <div>
        <Label>Venue photos (shown on your public page)</Label>
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

      <Button type="submit" disabled={saving || !validColor}>
        {saving ? "Saving…" : "Save branding"}
      </Button>
    </form>
  );
}
