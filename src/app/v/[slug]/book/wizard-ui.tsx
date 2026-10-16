"use client";

// Presentational pieces for the public booking wizard. Everything brand-
// coloured derives its text colour from textOnColor() so any venue colour
// stays readable.

import * as React from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { textOnColor } from "@/lib/color";
import { formatInVenueTz, venueLocalToUtc } from "@/lib/time";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const STEP_LABELS = ["Date", "Space", "Add-ons", "Details", "Review"] as const;

// ---------------------------------------------------------------------------
// Formatting helpers (venue timezone only)
// ---------------------------------------------------------------------------

/** "Eastern Time" style name for an IANA zone; falls back to the zone id. */
export function tzLabel(timezone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longGeneric" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? timezone.replace(/_/g, " ");
  } catch {
    return timezone.replace(/_/g, " ");
  }
}

/** A venue-local calendar date ("2026-10-18") formatted, e.g. "Sat, Oct 18". */
export function fmtVenueDate(timezone: string, date: string, fmt = "EEE, MMM d, yyyy"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return formatInVenueTz(venueLocalToUtc(timezone, date, "12:00"), timezone, fmt);
}

/** A venue-local wall-clock time ("17:00") as "5:00 PM". */
export function fmtVenueTime(timezone: string, date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return time;
  return formatInVenueTz(venueLocalToUtc(timezone, date, time), timezone, "h:mm a");
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Panel({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(27,26,34,0.04)] sm:p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export const StepHeading = React.forwardRef<
  HTMLHeadingElement,
  { title: string; description?: React.ReactNode }
>(function StepHeading({ title, description }, ref) {
  return (
    <div className="mb-5">
      <h2
        ref={ref}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight text-foreground focus:outline-none"
      >
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
});

export const STEP_TITLES = ["Date & time", "Choose a space", "Add-ons", "Your details", "Review"] as const;

/** Segmented progress bar: "Step N of 5" + step name; completed segments jump back. */
export function Stepper({
  current,
  brandColor,
  onJump,
}: {
  current: number;
  brandColor: string;
  onJump: (step: number) => void;
}) {
  const total = STEP_LABELS.length;
  return (
    <nav aria-label="Booking progress" className="mb-6">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Step {current} of {total}
        </p>
        <p className="truncate text-sm font-medium text-foreground">{STEP_TITLES[current - 1]}</p>
      </div>
      <ol className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "active" : "todo";
          const bar = (
            <span
              aria-hidden
              className={cn("block h-1.5 w-full rounded-full", state === "todo" && "bg-border")}
              style={state !== "todo" ? { backgroundColor: brandColor } : undefined}
            />
          );
          return (
            <li key={label} aria-current={state === "active" ? "step" : undefined}>
              {state === "done" ? (
                <button
                  type="button"
                  onClick={() => onJump(n)}
                  className="flex min-h-6 w-full items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="sr-only">
                    Go back to step {n}: {STEP_TITLES[i]} (completed)
                  </span>
                  {bar}
                </button>
              ) : (
                <div className="flex min-h-6 items-center">
                  <span className="sr-only">
                    Step {n}: {STEP_TITLES[i]}
                    {state === "todo" ? " (not started)" : " (current)"}
                  </span>
                  {bar}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export function BrandButton({
  color,
  className,
  children,
  loading = false,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { color: string; loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-semibold shadow-sm transition-[filter,opacity] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      style={{ backgroundColor: color, color: textOnColor(color), ...style }}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center gap-1 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}

/** Mobile: primary full width on top, Back below. Desktop: Back left, primary right. */
export function StepActions({ back, primary }: { back?: React.ReactNode; primary: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between [&>*]:w-full sm:[&>*]:w-auto">
      {back ?? <span className="hidden sm:block" />}
      {primary}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading states
// ---------------------------------------------------------------------------

export function AvailabilitySkeleton({ label }: { label: string }) {
  return (
    <Panel aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Checking availability…</h2>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
      <p role="status" className="mt-1 text-sm text-muted-foreground">
        {label}
      </p>
      <div className="mt-5 grid grid-cols-7 gap-2" aria-hidden>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
      <div className="mt-4 space-y-3" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border p-4">
            <Skeleton className="h-28 w-full" />
            <div className="mt-3 flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function PriceUpdating() {
  return (
    <div role="status" className="flex items-center gap-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Updating total…</p>
        <p className="text-[13px] text-muted-foreground">
          Your selections remain in place while pricing refreshes.
        </p>
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  );
}
