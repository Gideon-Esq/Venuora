// Public-page imagery: plain <img> for external URLs (next/image not
// required), with a calm neutral placeholder when a venue/space has no photo.

import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PhotoOrPlaceholder({
  src,
  alt,
  className,
  loading = "lazy",
}: {
  src?: string | null;
  alt: string;
  /** Kept for API compatibility; placeholders are no longer varied. */
  seed?: number;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={1200}
        height={800}
        loading={loading}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn("flex h-full w-full items-center justify-center bg-muted text-muted-foreground/60", className)}
    >
      <ImageIcon className="h-8 w-8" aria-hidden />
    </div>
  );
}

/** Parse a Prisma Json photos column into a string[] safely. */
export function photoList(json: unknown): string[] {
  return Array.isArray(json) ? json.filter((p): p is string => typeof p === "string") : [];
}
