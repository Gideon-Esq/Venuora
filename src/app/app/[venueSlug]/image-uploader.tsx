"use client";

import { useId, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IMAGE_ACCEPT, IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/image-upload";

export function ImageUploader({ slug, label = "Upload photos", maxFiles = 20, disabled = false, onUpload, onBusyChange }: {
  slug: string; label?: string; maxFiles?: number; disabled?: boolean;
  onUpload: (urls: string[]) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function upload(files: File[]) {
    if (lock.current || !files.length) return;
    setError(""); setMessage("");
    if (files.length > maxFiles) { setError(`Choose up to ${maxFiles} image${maxFiles === 1 ? "" : "s"}.`); return; }
    const invalid = files.find(file => !IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES || file.size === 0);
    if (invalid) { setError(`${invalid.name}: choose a JPG, PNG, WebP or GIF image under 3 MB.`); return; }
    lock.current = true; setBusy(true); onBusyChange?.(true);
    let uploaded = 0;
    try {
      for (const file of files) {
        setMessage(`Uploading image ${uploaded + 1} of ${files.length}…`);
        const response = await fetch(`/api/venues/${encodeURIComponent(slug)}/images`, { method: "POST", headers: { "content-type": file.type }, body: file, signal: AbortSignal.timeout(45_000) });
        const result = await response.json().catch(() => null);
        if (!response.ok || typeof result?.url !== "string") throw new Error(typeof result?.error === "string" ? result.error : "Upload failed. Please try again.");
        onUpload([result.url]); uploaded++;
      }
      setMessage(`${uploaded} image${uploaded === 1 ? "" : "s"} uploaded. Save your changes to use ${uploaded === 1 ? "it" : "them"}.`);
    } catch (cause) {
      setMessage(uploaded ? `${uploaded} image${uploaded === 1 ? "" : "s"} uploaded successfully.` : "");
      setError(cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "The upload timed out. Please try again.");
    } finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <div className="space-y-2">
    <input ref={input} id={id} type="file" accept={IMAGE_ACCEPT} multiple={maxFiles > 1} className="sr-only" tabIndex={-1} disabled={disabled || busy || maxFiles < 1} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void upload(files); }} aria-label={label} />
    <Button type="button" variant="outline" disabled={disabled || busy || maxFiles < 1} onClick={() => input.current?.click()} aria-describedby={`${id}-hint`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}{busy ? "Uploading…" : label}
    </Button>
    <p id={`${id}-hint`} className="text-xs text-muted-foreground">JPG, PNG, WebP or GIF · up to 3 MB each. Images are public once uploaded.</p>
    <p role="status" className="text-xs text-muted-foreground">{message}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
