"use client";

// "Legend" button → small popover explaining chip/bar styles (replaces the
// old always-on legend card).

import * as React from "react";
import { Check, CircleHelp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalSpace } from "./cal-shared";
import { SpaceDot, hatchStyle } from "./cal-ui";

export function LegendPopover({ spaces }: { spaces: CalSpace[] }) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        wrapRef.current?.querySelector("button")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <CircleHelp className="h-4 w-4" aria-hidden />
        Legend
      </Button>
      <div
        id={panelId}
        role="region"
        aria-label="Calendar legend"
        hidden={!open}
        className={cn(
          "absolute right-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 text-sm shadow-lg"
        )}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What the colours mean
        </p>
        <ul className="space-y-2.5">
          <LegendRow
            swatch={
              <span className="inline-flex h-5 w-8 items-center justify-center rounded-md border-l-[3px] border-l-primary bg-accent text-accent-foreground">
                <Check className="h-3.5 w-3.5" aria-hidden />
              </span>
            }
          >
            Confirmed — blocks the space
          </LegendRow>
          <LegendRow
            swatch={
              <span className="inline-flex h-5 w-8 items-center justify-center rounded-md border border-warning-border border-l-[3px] border-l-[#c98a1b] bg-warning-soft text-warning">
                <Clock className="h-3.5 w-3.5" aria-hidden />
              </span>
            }
          >
            Penciled hold — blocks until it expires
          </LegendRow>
          <LegendRow
            swatch={
              <span className="inline-block h-5 w-8 rounded-md border border-dashed border-[#8b8797] bg-card" />
            }
          >
            Tentative inquiry / quote — doesn&apos;t block
          </LegendRow>
          <LegendRow
            swatch={
              <span
                className="inline-block h-5 w-8 rounded-md border border-border"
                style={hatchStyle("#5145ae")}
              />
            }
          >
            Setup / teardown buffer
          </LegendRow>
          <LegendRow
            swatch={
              <span className="inline-flex h-5 w-8 items-center justify-center rounded-md bg-muted font-semibold text-foreground">
                ‹ ›
              </span>
            }
          >
            Continues past the edge
          </LegendRow>
        </ul>
        {spaces.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Spaces
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {spaces.map((s) => (
                <li key={s.id} className="inline-flex items-center gap-1.5 text-foreground">
                  <SpaceDot color={s.color} className="h-2.5 w-2.5" />
                  {s.name}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function LegendRow({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-foreground">
      <span aria-hidden className="shrink-0">
        {swatch}
      </span>
      <span>{children}</span>
    </li>
  );
}
