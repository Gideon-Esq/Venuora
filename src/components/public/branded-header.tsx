// Venue-branded header for client-facing token pages (/b, /q) and the
// public venue routes: brand-color bar + logo/name. Server-safe.

import Link from "next/link";
import { textOnColor } from "@/lib/color";

export interface VenueBrandProps {
  name: string;
  logoUrl?: string | null;
  brandColor: string;
  /** Optional link target for the venue name (e.g. /v/slug). */
  href?: string;
}

export function BrandedHeader({ name, logoUrl, brandColor, href }: VenueBrandProps) {
  const inner = (
    <span className="inline-flex items-center gap-3">
      {logoUrl ? (
        // Plain <img>: external, unoptimizable URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 rounded-lg object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold"
          style={{ backgroundColor: brandColor, color: textOnColor(brandColor) }}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="text-base font-semibold tracking-tight text-foreground">{name}</span>
    </span>
  );

  return (
    <header className="bg-card">
      <div aria-hidden className="h-1.5 w-full" style={{ backgroundColor: brandColor }} />
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        {href ? <Link href={href}>{inner}</Link> : inner}
      </div>
      <div className="h-px w-full bg-border" />
    </header>
  );
}

export function PoweredByFooter() {
  return (
    <footer className="mx-auto w-full max-w-3xl px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
      Powered by{" "}
      <Link href="/" className="font-medium text-muted-foreground hover:text-foreground">
        Venuora
      </Link>
    </footer>
  );
}
