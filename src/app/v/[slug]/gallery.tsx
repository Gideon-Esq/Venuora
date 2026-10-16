"use client";

// Venue photo gallery: up to 3 thumbnails + a "View N photos" button that
// opens a keyboard-navigable lightbox (← / → keys, Esc closes via <dialog>).
import * as React from "react";
import { ChevronLeft, ChevronRight, ImageOff, Images } from "lucide-react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function VenueGallery({ photos, venueName }: { photos: string[]; venueName: string }) {
  const [index, setIndex] = React.useState<number | null>(null);
  const [failed, setFailed] = React.useState<ReadonlySet<number>>(() => new Set());
  const markFailed = React.useCallback(
    (i: number) => setFailed((prev) => (prev.has(i) ? prev : new Set(prev).add(i))),
    []
  );
  const open = index !== null;
  const count = photos.length;

  const go = React.useCallback(
    (delta: number) =>
      setIndex((i) => (i === null ? i : (i + delta + count) % count)),
    [count]
  );

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  if (count === 0) return null;
  const alt = (i: number) => `${venueName} — photo ${i + 1} of ${count}`;

  return (
    <section
      aria-labelledby="gallery-heading"
      className="sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-4"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3 sm:sr-only">
        <h2 id="gallery-heading" className="text-2xl font-semibold tracking-tight text-foreground">
          Gallery
        </h2>
        <p className="text-sm text-muted-foreground">
          {count} {count === 1 ? "photo" : "photos"}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photos.slice(0, 3).map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Open ${alt(i)}`}
            className="aspect-[4/3] overflow-hidden rounded-lg bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {failed.has(i) ? (
              <PhotoUnavailable />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                loading="lazy"
                width={400}
                height={300}
                onError={() => markFailed(i)}
                ref={(el) => {
                  // Catch images that failed before hydration attached onError.
                  if (el && el.complete && el.naturalWidth === 0) markFailed(i);
                }}
                className="h-full w-full object-cover transition-transform hover:scale-[1.03]"
              />
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setIndex(0)}
        className={cn(buttonVariants({ variant: "outline" }), "mt-3 w-full")}
      >
        View {count} {count === 1 ? "photo" : "photos"}
        <Images className="h-4 w-4" aria-hidden />
      </button>

      <Dialog open={open} onClose={() => setIndex(null)} className="max-w-4xl">
        {index !== null && (
          <div>
            <DialogTitle>
              {venueName} photos
              <span className="ml-2 text-sm font-normal text-muted-foreground" aria-live="polite">
                {index + 1} of {count}
              </span>
            </DialogTitle>
            <div className="mt-4 overflow-hidden rounded-lg bg-muted">
              {failed.has(index) ? (
                <div role="img" aria-label={`${alt(index)} (unavailable)`} className="aspect-[4/3]">
                  <PhotoUnavailable />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={index}
                  src={photos[index]}
                  alt={alt(index)}
                  width={1200}
                  height={800}
                  onError={() => markFailed(index)}
                  className="max-h-[65vh] w-full object-contain"
                />
              )}
            </div>
            {count > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous photo"
                  className={buttonVariants({ variant: "outline", size: "icon" })}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <p className="text-xs text-muted-foreground">Use ← → keys to browse</p>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next photo"
                  className={buttonVariants({ variant: "outline", size: "icon" })}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </section>
  );
}

function PhotoUnavailable() {
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-muted p-2 text-center text-xs text-muted-foreground">
      <ImageOff className="h-5 w-5" aria-hidden />
      Photo unavailable
    </span>
  );
}
