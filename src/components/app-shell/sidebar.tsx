"use client";

// Owner-app shell: fixed sidebar on desktop, collapsible top bar on mobile.

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  ExternalLink,
  Home,
  LogOut,
  Menu,
  Package,
  Settings,
  Sofa,
  Users,
  Footprints,
  X,
} from "lucide-react";
import { signOutAction } from "@/actions/auth";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ShellVenue {
  slug: string;
  name: string;
  brandColor: string;
  published: boolean;
}

export interface SwitcherVenue {
  slug: string;
  name: string;
}

const NAV = [
  { label: "This week", segment: "", icon: Home, exact: true },
  { label: "Calendar", segment: "calendar", icon: CalendarDays },
  { label: "Bookings", segment: "bookings", icon: ClipboardList },
  { label: "Clients", segment: "clients", icon: Users },
  { label: "Tours", segment: "tours", icon: Footprints },
  { label: "Spaces", segment: "spaces", icon: Sofa },
  { label: "Add-ons", segment: "add-ons", icon: Package },
  { label: "Settings", segment: "settings", icon: Settings },
] as const;

function NavLinks({ venue, onNavigate }: { venue: ShellVenue; onNavigate?: () => void }) {
  const pathname = usePathname();
  const base = `/app/${venue.slug}`;
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const href = item.segment ? `${base}/${item.segment}` : base;
        const active =
          "exact" in item && item.exact ? pathname === href : pathname.startsWith(href);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            )}
          >
            <Icon className={cn("h-4 w-4", active ? "text-indigo-600" : "text-zinc-400")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function VenueSwitcher({
  venue,
  venues,
}: {
  venue: ShellVenue;
  venues: SwitcherVenue[];
}) {
  const router = useRouter();
  if (venues.length <= 1) return null;
  return (
    <div className="mt-3">
      <Select
        aria-label="Switch venue"
        className="h-9 text-xs"
        value={venue.slug}
        onChange={(e) => router.push(`/app/${e.target.value}`)}
      >
        {venues.map((v) => (
          <option key={v.slug} value={v.slug}>
            {v.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

function ShellInner({
  venue,
  venues,
  onNavigate,
}: {
  venue: ShellVenue;
  venues: SwitcherVenue[];
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: venue.brandColor }}
          />
          <p className="truncate text-sm font-semibold text-zinc-900">{venue.name}</p>
        </div>
        <VenueSwitcher venue={venue} venues={venues} />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks venue={venue} onNavigate={onNavigate} />
      </div>

      <div className="border-t border-zinc-200 px-3 py-3">
        <a
          href={`/v/${venue.slug}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <ExternalLink className="h-4 w-4 text-zinc-400" />
          <span className="flex-1">View public page</span>
        </a>
        {!venue.published && (
          <p className="px-3 pb-1 text-xs text-amber-600">Not published yet</p>
        )}
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <LogOut className="h-4 w-4 text-zinc-400" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export function AppSidebar({
  venue,
  venues,
}: {
  venue: ShellVenue;
  venues: SwitcherVenue[];
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-zinc-200 bg-white lg:block">
        <ShellInner venue={venue} venues={venues} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span
          aria-hidden
          className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/10"
          style={{ backgroundColor: venue.brandColor }}
        />
        <p className="truncate text-sm font-semibold text-zinc-900">{venue.name}</p>
      </header>

      {/* Mobile slide-over */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-zinc-950/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <div className="flex justify-end p-2">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100%-3rem)]">
              <ShellInner venue={venue} venues={venues} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
