"use client";

import * as React from "react";
import { TourActions, TourDrawer, TourStatusBadge, useTourStatus } from "./tour-drawer";
import type { TourView } from "./tour-shared";

/**
 * Rows for one Tours section. Clicking a row (or its name) opens the shared
 * drawer; contact links and action buttons work in place.
 */
export function TourList({
  slug,
  tours,
  emphasizeComplete = false,
}: {
  slug: string;
  tours: TourView[];
  emphasizeComplete?: boolean;
}) {
  const tourStatus = useTourStatus(slug);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = tours.find((t) => t.id === openId) ?? null;

  return (
    <>
      <ul className="space-y-3 p-5 sm:p-6">
        {tours.map((t) => (
          <li
            key={t.id}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a,button")) return;
              setOpenId(t.id);
            }}
            className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted font-medium text-muted-foreground">{t.name.trim().slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0"><button type="button" onClick={() => setOpenId(t.id)} className="rounded text-left font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">{t.name}</button><p className="mt-1 text-sm text-muted-foreground">{t.when}{t.spaceName ? ` · ${t.spaceName}` : ""}</p></div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <TourStatusBadge status={t.status} />
              {t.status === "CONFIRMED" ? <TourActions tour={t} tourStatus={tourStatus} emphasizeComplete={emphasizeComplete} /> : <button type="button" onClick={() => setOpenId(t.id)} className="min-h-10 rounded-lg px-3 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">View details</button>}
            </div>
          </li>
        ))}
      </ul>
      <TourDrawer tour={open} onClose={() => setOpenId(null)} canManage tourStatus={tourStatus} />
    </>
  );
}
