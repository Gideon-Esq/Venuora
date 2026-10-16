"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  GripVertical,
  ImageIcon,
  Loader2,
  Menu,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHint, Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateBrandingAction } from "@/actions/venue";
import { textOnColor, whiteTextPassesAA } from "@/lib/color";
import { cn } from "@/lib/utils";
import { ImageUploader } from "../../image-uploader";

export interface BrandingInitial {
  brandColor: string;
  logoUrl: string;
  photos: string[];
}

const PRESETS = [
  { name: "Indigo", hex: "#5145ae" },
  { name: "Teal", hex: "#159a85" },
  { name: "Forest", hex: "#2f6b3a" },
  { name: "Plum", hex: "#6b2f7a" },
  { name: "Terracotta", hex: "#b65d43" },
  { name: "Gold", hex: "#b7860b" },
  { name: "Slate", hex: "#475066" },
  { name: "Rose", hex: "#be3f63" },
] as const;

const MAX_PHOTOS = 20;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

type PhotoRow = { id: number; url: string };
type FormState = { brandColor: string; logoUrl: string; photos: PhotoRow[] };

let rowSeq = 0;
const toRows = (urls: string[]): PhotoRow[] => urls.map((url) => ({ id: ++rowSeq, url }));

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function presetName(hex: string): string | null {
  return PRESETS.find((p) => p.hex.toLowerCase() === hex.toLowerCase())?.name ?? null;
}

function serialize(s: FormState) {
  return {
    brandColor: s.brandColor.trim(),
    logoUrl: s.logoUrl.trim(),
    photos: s.photos.map((p) => p.url.trim()).filter(Boolean),
  };
}

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
  const toast = useToast();
  const [saved, setSaved] = React.useState<BrandingInitial>(initial);
  const [state, setState] = React.useState<FormState>(() => ({
    brandColor: initial.brandColor,
    logoUrl: initial.logoUrl,
    photos: toRows(initial.photos),
  }));
  const [saving, setSaving] = React.useState(false);
  const [uploads, setUploads] = React.useState(0);
  const uploadBusy = (busy: boolean) => setUploads(count => count + (busy ? 1 : -1));
  const [error, setError] = React.useState<string | null>(null);

  const { brandColor, logoUrl, photos } = state;
  const colorValid = HEX_RE.test(brandColor.trim());
  const color = colorValid ? brandColor.trim() : saved.brandColor;
  const onColor = textOnColor(color);
  const logoTrim = logoUrl.trim();
  const logoValid = logoTrim === "" || isHttpUrl(logoTrim);
  const photoErrors = photos.map((p) => p.url.trim() !== "" && !isHttpUrl(p.url.trim()));
  const formValid = colorValid && logoValid && !photoErrors.some(Boolean);

  const current = serialize(state);
  const dirty =
    current.brandColor.toLowerCase() !== saved.brandColor.toLowerCase() ||
    current.logoUrl !== saved.logoUrl ||
    current.photos.join("\n") !== saved.photos.join("\n");

  const update = (patch: Partial<FormState>) => setState((s) => ({ ...s, ...patch }));
  const setPhotos = (fn: (rows: PhotoRow[]) => PhotoRow[]) =>
    setState((s) => ({ ...s, photos: fn(s.photos) }));

  function move(from: number, to: number) {
    if (to < 0 || to >= photos.length || from === to) return;
    setPhotos((rows) => {
      const next = [...rows];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function discard() {
    setState({ brandColor: saved.brandColor, logoUrl: saved.logoUrl, photos: toRows(saved.photos) });
    setError(null);
  }

  async function save() {
    if (!formValid || saving || uploads > 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await updateBrandingAction(slug, current);
      if (res.ok) {
        setSaved(current);
        setState({ brandColor: current.brandColor, logoUrl: current.logoUrl, photos: toRows(current.photos) });
        toast("Branding saved");
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong on our side. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Drag-and-drop reorder (mouse); Move up/down buttons cover keyboard and touch.
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);
  const [announce, setAnnounce] = React.useState("");

  const selectedName = colorValid ? presetName(brandColor) : null;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-1.5">
            <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <li>
                <Link href={`/app/${slug}/settings`} className="rounded hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                  Settings
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page">Branding</li>
            </ol>
          </nav>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Branding</h2>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Customize how {venueName} appears to clients.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={discard} disabled={!dirty || saving || uploads > 0}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Discard
          </Button>
          <Button type="submit" disabled={!dirty || !formValid || saving || uploads > 0}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {error && (
        <Callout tone="danger" title="We couldn’t save your branding">
          {error}
        </Callout>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        <div className="min-w-0 space-y-6">
          {/* Brand colour */}
          <Card>
            <CardHeader>
              <CardTitle>Brand colour</CardTitle>
              <CardDescription>
                Choose the primary colour used across your public booking experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div role="group" aria-label="Preset colours" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PRESETS.map((p) => {
                  const selected = brandColor.trim().toLowerCase() === p.hex;
                  return (
                    <button
                      key={p.hex}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => update({ brandColor: p.hex })}
                      className={cn(
                        "flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg border bg-card px-2 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        selected ? "border-primary ring-2 ring-primary/40" : "border-border"
                      )}
                    >
                      <span
                        className="h-6 w-6 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: p.hex }}
                        aria-hidden
                      />
                      {p.name}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="brand-hex">Custom hex</Label>
                  <Input
                    id="brand-hex"
                    value={brandColor}
                    onChange={(e) => update({ brandColor: e.target.value })}
                    placeholder="#5145ae"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono uppercase"
                    aria-invalid={!colorValid || undefined}
                    aria-describedby={!colorValid ? "brand-hex-error" : undefined}
                  />
                </div>
                <div className="flex h-12 items-center gap-3 rounded-lg border border-border bg-muted px-3 sm:h-auto sm:min-h-[52px]">
                  <span
                    className="h-7 w-7 shrink-0 rounded-md ring-1 ring-black/10"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <span className="text-sm leading-tight">
                    <span className="block font-medium text-foreground">{selectedName ?? "Custom"}</span>
                    <span className="block font-mono text-xs uppercase text-muted-foreground">{color}</span>
                  </span>
                </div>
              </div>
              {!colorValid && (
                <FieldHint id="brand-hex-error" error className="-mt-3">
                  Use a 6-digit hex colour like #5145AE.
                </FieldHint>
              )}

              {whiteTextPassesAA(color) ? (
                <Callout tone="info">White text passes AA contrast on primary buttons.</Callout>
              ) : (
                <Callout tone="warning">
                  White text is hard to read on this colour. Buttons will use dark text automatically.
                </Callout>
              )}

              <BrandButton color={color} onColor={onColor}>
                Book this space
              </BrandButton>
            </CardContent>
          </Card>

          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
              <CardDescription>Upload your venue logo from your phone or computer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUploader slug={slug} label={logoUrl ? "Replace logo" : "Upload logo"} maxFiles={1} disabled={saving || uploads > 0} onBusyChange={uploadBusy} onUpload={urls => update({ logoUrl: urls[0] })} />
              {logoUrl && <Button type="button" variant="ghost" disabled={saving || uploads > 0} onClick={() => update({ logoUrl: "" })}>Remove logo</Button>}
              <details className="text-sm text-muted-foreground"><summary className="cursor-pointer py-2">Use an existing image link instead</summary><div>
                <Label htmlFor="brand-logo">Logo URL</Label>
                <Input
                  id="brand-logo"
                  type="url"
                  inputMode="url"
                  value={logoUrl}
                  onChange={(e) => update({ logoUrl: e.target.value })}
                  placeholder="https://cdn.example.com/logo.png"
                  aria-invalid={!logoValid || undefined}
                  aria-describedby={!logoValid ? "brand-logo-error" : undefined}
                />
                {!logoValid && (
                  <FieldHint id="brand-logo-error" error>
                    Enter a full link starting with https://
                  </FieldHint>
                )}
              </div>
              </details>
              <LogoPreview
                url={logoValid ? logoTrim : ""}
                venueName={venueName}
                color={color}
              />

            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle>Venue photos</CardTitle>
              <CardDescription>
                Upload up to {MAX_PHOTOS} photos. The first photo is your cover; drag or use the arrows to reorder.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ImageUploader slug={slug} maxFiles={MAX_PHOTOS - photos.length} disabled={saving || uploads > 0} onBusyChange={uploadBusy} onUpload={urls => setPhotos(rows => [...rows, ...toRows(urls)].slice(0, MAX_PHOTOS))} />
              {photos.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Show clients what makes your venue special. Upload your first photos.
                </p>
              )}
              <ol className="space-y-3">
                {photos.map((row, i) => {
                  const invalid = photoErrors[i];
                  const inputId = `photo-${row.id}`;
                  return (
                    <li
                      key={row.id}
                      onDragOver={(e) => {
                        if (dragIndex === null) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (overIndex !== i) setOverIndex(i);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null) move(dragIndex, i);
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      className={cn(
                        "rounded-lg border bg-card p-3 transition-colors",
                        overIndex === i && dragIndex !== null && dragIndex !== i
                          ? "border-primary bg-accent/40"
                          : "border-border",
                        dragIndex === i && "opacity-50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <PhotoThumb key={row.url.trim()} url={invalid ? "" : row.url.trim()} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">Photo {i + 1}{i === 0 ? " · Cover image" : ""}</p>
                          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-2">Image link</summary>
                          <Label htmlFor={inputId} className="sr-only">
                            Photo {i + 1} URL
                          </Label>
                          <Input
                            id={inputId}
                            type="url"
                            inputMode="url"
                            value={row.url}
                            onChange={(e) =>
                              setPhotos((rows) =>
                                rows.map((r) => (r.id === row.id ? { ...r, url: e.target.value } : r))
                              )
                            }
                            placeholder="https://images.example.com/photo.jpg"
                            aria-invalid={invalid || undefined}
                            aria-describedby={invalid ? `${inputId}-error` : undefined}
                          />
                          {invalid && (
                            <FieldHint id={`${inputId}-error`} error>
                              Enter a full link starting with https://
                            </FieldHint>
                          )}
                          </details>
                          <div className="mt-2 flex items-center gap-1 sm:hidden">
                            <ReorderButtons
                              index={i}
                              count={photos.length}
                              onMove={(to) => {
                                move(i, to);
                                setAnnounce(`Photo moved to position ${to + 1} of ${photos.length}`);
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span
                            draggable
                            onDragStart={(e) => {
                              setDragIndex(i);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", String(i));
                              const li = e.currentTarget.closest("li");
                              if (li) e.dataTransfer.setDragImage(li, 24, 24);
                            }}
                            onDragEnd={() => {
                              setDragIndex(null);
                              setOverIndex(null);
                            }}
                            title="Drag to reorder"
                            aria-hidden
                            className="hidden h-10 w-10 cursor-grab items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted active:cursor-grabbing sm:flex"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <span className="hidden items-center gap-1 sm:flex">
                            <ReorderButtons
                              index={i}
                              count={photos.length}
                              onMove={(to) => {
                                move(i, to);
                                setAnnounce(`Photo moved to position ${to + 1} of ${photos.length}`);
                              }}
                            />
                          </span>
                          <Button
                            type="button"
                            variant="destructive-outline"
                            size="icon"
                            aria-label={`Remove photo ${i + 1}`}
                            onClick={() => setPhotos((rows) => rows.filter((r) => r.id !== row.id))}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <span className="sr-only" aria-live="polite">
                {announce}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={photos.length >= MAX_PHOTOS || saving || uploads > 0}
                  onClick={() => setPhotos((rows) => [...rows, ...toRows([""])])}
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add photo URL
                </Button>
                <span className="text-[13px] text-muted-foreground">
                  {photos.length} of {MAX_PHOTOS}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live previews */}
        <aside aria-labelledby="previews-heading" className="min-w-0 space-y-4 xl:sticky xl:top-6">
          <h2
            id="previews-heading"
            className="flex items-center gap-2 text-[17px] font-semibold text-foreground"
          >
            <Eye className="h-5 w-5 text-primary" aria-hidden /> Live previews
          </h2>

          <Card className="overflow-hidden">
            <p className="border-b border-border bg-muted px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Public venue header
            </p>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 truncate text-lg font-semibold text-foreground">{venueName}</p>
                <BrandButton color={color} onColor={onColor} size="sm">
                  Book this space
                </BrandButton>
              </div>
              <div
                className="h-24 rounded-lg"
                style={{ background: `linear-gradient(120deg, ${color}99, ${color}26)` }}
                aria-hidden
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <p className="border-b border-border bg-muted px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Client email header
            </p>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <p className="min-w-0 truncate text-lg font-semibold" style={{ color }}>
                  {venueName}
                </p>
                <Menu className="h-5 w-5 text-muted-foreground" aria-hidden />
              </div>
              <div className="flex items-center justify-between gap-3 pt-3">
                <span className="text-sm text-muted-foreground">Your booking is confirmed.</span>
                <span className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground">
                  View booking
                </span>
              </div>
            </div>
          </Card>

          <Link href={`/app/${slug}/emails`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">View your email templates</Link>
          <Card className="border-accent bg-accent/50 p-5">
            <p className="font-semibold text-foreground">Ready to book?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Reserve {venueName} for your next gathering.
            </p>
            <BrandButton color={color} onColor={onColor} className="mt-4 w-full">
              Book this space
            </BrandButton>
          </Card>
        </aside>
      </div>
    </form>
  );
}

/** Non-interactive preview of a brand-coloured button. */
function BrandButton({
  color,
  onColor,
  size = "default",
  className,
  children,
}: {
  color: string;
  onColor: string;
  size?: "default" | "sm";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium shadow-sm",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        className
      )}
      style={{ backgroundColor: color, color: onColor }}
    >
      {children}
    </span>
  );
}

function ReorderButtons({
  index,
  count,
  onMove,
}: {
  index: number;
  count: number;
  onMove: (to: number) => void;
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Move photo ${index + 1} up`}
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        <ArrowUp className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Move photo ${index + 1} down`}
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        <ArrowDown className="h-4 w-4" aria-hidden />
      </Button>
    </>
  );
}

/** Thumbnail that falls back to a muted placeholder when the image can't load. Remount (key) on URL change. */
function PhotoThumb({ url }: { url: string }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground sm:h-16 sm:w-16">
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <ImageIcon className="h-5 w-5" aria-hidden />
      )}
    </div>
  );
}

function LogoPreview({ url, venueName, color }: { url: string; venueName: string; color: string }) {
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const showImage = url !== "" && failedUrl !== url;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4">
      <div className="flex h-16 min-w-32 max-w-full items-center justify-center rounded-lg bg-muted px-5">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`${venueName} logo`}
            className="max-h-12 max-w-[200px] object-contain"
            onError={() => setFailedUrl(url)}
          />
        ) : (
          <span className="truncate text-lg font-semibold tracking-tight" style={{ color }}>
            {venueName}
          </span>
        )}
      </div>
      <span className="text-sm text-muted-foreground">
        {showImage
          ? "Logo preview"
          : url
            ? "We couldn’t load that image, so clients will see your wordmark."
            : "Wordmark preview"}
      </span>
    </div>
  );
}
