"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleSlash, Clock, Search, Users, Zap, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DeactivateSpaceButton } from "./deactivate-button";

export interface SpaceRow {
  id: string;
  name: string;
  description: string;
  photo: string | null;
  color: string;
  active: boolean;
  instantBook: boolean;
  seated: number;
  standing: number;
  setupMins: number;
  teardownMins: number;
  /** Pre-formatted base hourly rate, or null when no rate plan exists. */
  fromRate: string | null;
}

type Filter = "all" | "active" | "inactive";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function Thumb({ row, large = false }: { row: SpaceRow; large?: boolean }) {
  if (row.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={row.photo}
        alt=""
        className={cn(large ? "mb-4 aspect-[3/2] w-full rounded-lg object-cover" : "h-11 w-16 shrink-0 rounded-md object-cover", !row.active && "opacity-60 grayscale")}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={large ? "mb-4 flex aspect-[3/2] w-full items-end rounded-lg p-4" : "flex h-11 w-16 shrink-0 items-end rounded-md p-1.5"}
      style={{ background: `linear-gradient(135deg, ${row.color}22, ${row.color}66)` }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
    </span>
  );
}

function StatusChip({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="success">
      <CheckCircle2 aria-hidden /> Active
    </Badge>
  ) : (
    <Badge variant="muted">
      <CircleSlash aria-hidden /> Inactive
    </Badge>
  );
}

function BookingMode({ instant }: { instant: boolean }) {
  return instant ? (
    <span className="inline-flex items-center gap-1.5">
      <Zap className="h-3.5 w-3.5 text-primary" aria-hidden /> Instant booking
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> Request to book
    </span>
  );
}

function Rates({ row }: { row: SpaceRow }) {
  return row.fromRate ? (
    <span className="font-medium text-foreground">From {row.fromRate}/hr</span>
  ) : (
    <Badge variant="warning">
      <AlertTriangle aria-hidden /> No rates
    </Badge>
  );
}

export function SpacesList({ slug, spaces }: { slug: string; spaces: SpaceRow[] }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();
  const visible = spaces.filter((s) => {
    if (filter === "active" && !s.active) return false;
    if (filter === "inactive" && s.active) return false;
    if (q && !`${s.name} ${s.description}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const counts: Record<Filter, number> = {
    all: spaces.length,
    active: spaces.filter((s) => s.active).length,
    inactive: spaces.filter((s) => !s.active).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="radiogroup"
          aria-label="Filter spaces by status"
          className="inline-flex w-full rounded-lg border border-border bg-card p-1 sm:w-auto"
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const i = FILTERS.findIndex((f) => f.value === filter);
            const next = FILTERS[(i + (e.key === "ArrowRight" ? 1 : FILTERS.length - 1)) % FILTERS.length];
            setFilter(next.value);
            const btn = e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`);
            btn?.focus();
          }}
        >
          {FILTERS.map((f) => {
            const selected = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                data-value={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:flex-none",
                  selected
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {f.label}
                <span className="text-xs tabular-nums opacity-70">{counts[f.value]}</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search spaces"
            aria-label="Search spaces"
            className="pl-9"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <Card className="px-6 py-10 text-center">
          <p className="font-medium text-foreground">No spaces match</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q ? <>Nothing matches “{query.trim()}”. </> : null}Try a different search or filter.
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/70 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-3">Space</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3">Booking mode</th>
                    <th scope="col" className="px-3 py-3">Capacity</th>
                    <th scope="col" className="px-3 py-3">Setup / teardown</th>
                    <th scope="col" className="px-3 py-3">Rates</th>
                    <th scope="col" className="px-5 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((s) => (
                    <tr key={s.id} className={cn("align-middle", !s.active && "bg-muted/30")}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Thumb row={s} />
                          <div className="min-w-0 max-w-64">
                            <Link
                              href={`/app/${slug}/spaces/${s.id}`}
                              className="font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                            >
                              {s.name}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">
                              {!s.active ? "Not shown publicly" : s.description || "No description yet"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusChip active={s.active} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-foreground">
                        <BookingMode instant={s.instantBook} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-foreground">
                        {s.seated} seated · {s.standing} standing
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-foreground">
                        {s.setupMins} / {s.teardownMins} min
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Rates row={s} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/app/${slug}/spaces/${s.id}`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                            aria-label={`View ${s.name}`}
                          >
                            View
                          </Link>
                          {s.active ? (
                            <DeactivateSpaceButton
                              slug={slug}
                              spaceId={s.id}
                              spaceName={s.name}
                              appearance="text"
                              redirectToList={false}
                            />
                          ) : (
                            <span className="w-[84px] text-center text-xs text-muted-foreground">Inactive</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {visible.map((s) => (
              <li key={s.id}>
                <Card className={cn("p-4", !s.active && "bg-muted/30")}>
                  <Thumb row={s} large />
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/app/${slug}/spaces/${s.id}`}
                          className="font-semibold text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {s.name}
                        </Link>
                        <StatusChip active={s.active} />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {!s.active ? "Not shown publicly" : s.description || "No description yet"}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Booking mode</dt>
                      <dd className="text-foreground">
                        <BookingMode instant={s.instantBook} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Rates</dt>
                      <dd>
                        <Rates row={s} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Capacity</dt>
                      <dd className="inline-flex items-center gap-1.5 text-foreground">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        {s.seated} seated · {s.standing} standing
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Setup / teardown</dt>
                      <dd className="inline-flex items-center gap-1.5 text-foreground">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        {s.setupMins} / {s.teardownMins} min
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex items-center gap-2">
                    <Link
                      href={`/app/${slug}/spaces/${s.id}`}
                      className={buttonVariants({ variant: "outline", className: "flex-1" })}
                    >
                      View
                    </Link>
                    {s.active && (
                      <DeactivateSpaceButton
                        slug={slug}
                        spaceId={s.id}
                        spaceName={s.name}
                        appearance="text"
                        redirectToList={false}
                        className="h-10 px-4"
                      />
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
