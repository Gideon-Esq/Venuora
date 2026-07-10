// Public-page imagery: plain <img> for external URLs (next/image not
// required), with tasteful gradient placeholders when a venue/space has no
// photos yet.

import { cn } from "@/lib/utils";

const GRADIENTS = [
  "bg-gradient-to-br from-indigo-200 via-violet-100 to-zinc-100",
  "bg-gradient-to-br from-emerald-200 via-teal-100 to-zinc-100",
  "bg-gradient-to-br from-amber-200 via-orange-100 to-zinc-100",
  "bg-gradient-to-br from-sky-200 via-cyan-100 to-zinc-100",
  "bg-gradient-to-br from-rose-200 via-pink-100 to-zinc-100",
];

export function PhotoOrPlaceholder({
  src,
  alt,
  seed = 0,
  className,
  loading = "lazy",
}: {
  src?: string | null;
  alt: string;
  /** Varies the placeholder gradient so grids don't look flat. */
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
      className={cn("h-full w-full", GRADIENTS[Math.abs(seed) % GRADIENTS.length], className)}
    />
  );
}

/** Parse a Prisma Json photos column into a string[] safely. */
export function photoList(json: unknown): string[] {
  return Array.isArray(json) ? json.filter((p): p is string => typeof p === "string") : [];
}
