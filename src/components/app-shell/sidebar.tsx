"use client";

// Owner-app shell: top bar (wordmark, venue switcher, account menu) + a
// role-aware sidebar on desktop and a slide-over drawer below lg.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ClipboardList,
  ExternalLink,
  LayoutGrid,
  LogOut,
  Map as MapIcon,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { VenueRole } from "@/generated/prisma/enums";
import { signOutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";

export interface ShellVenue {
  slug: string;
  name: string;
  brandColor: string;
  published: boolean;
  timezone?: string;
}

export interface SwitcherVenue {
  slug: string;
  name: string;
}

export interface ShellUser {
  name: string;
  email: string;
  isSuperAdmin: boolean;
}

const ROLE_RANK: Record<VenueRole, number> = { STAFF: 0, MANAGER: 1, OWNER: 2 };
const ROLE_LABEL: Record<VenueRole, string> = { OWNER: "Owner", MANAGER: "Manager", STAFF: "Staff" };

// minRole mirrors the requireVenue() guard on each page, so nobody is shown a
// link that would 404 for them.
const NAV: { label: string; segment: string; icon: LucideIcon; minRole: VenueRole; exact?: boolean }[] = [
  { label: "This week", segment: "", icon: CalendarRange, minRole: "STAFF", exact: true },
  { label: "Calendar", segment: "calendar", icon: CalendarDays, minRole: "STAFF" },
  { label: "Operational records", segment: "records", icon: ClipboardList, minRole: "STAFF" },
  { label: "Bookings", segment: "bookings", icon: ClipboardList, minRole: "STAFF" },
  { label: "Clients", segment: "clients", icon: Users, minRole: "STAFF" },
  { label: "Email templates", segment: "emails", icon: ClipboardList, minRole: "MANAGER" },
  { label: "Tours", segment: "tours", icon: MapIcon, minRole: "MANAGER" },
  { label: "Spaces", segment: "spaces", icon: LayoutGrid, minRole: "MANAGER" },
  { label: "Add-ons", segment: "addons", icon: Sparkles, minRole: "MANAGER" },
  { label: "Settings", segment: "settings", icon: Settings, minRole: "OWNER" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Close a popover on outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function NavLinks({ venue, role, onNavigate, horizontal = false, iconOnly = false }: { venue: ShellVenue; role: VenueRole; onNavigate?: () => void; horizontal?: boolean; iconOnly?: boolean }) {
  const pathname = usePathname();
  const base = `/app/${venue.slug}`;
  return (
    <nav aria-label="Venue" className={cn("flex gap-1", horizontal ? "flex-row overflow-x-auto" : "flex-col")}>
      {NAV.filter((item) => ROLE_RANK[role] >= ROLE_RANK[item.minRole] && (item.segment !== "records" || role === "STAFF")).map((item) => {
        const href = item.segment ? `${base}/${item.segment}` : base;
        const active = item.exact ? pathname === href : pathname.startsWith(href);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={iconOnly ? item.label : undefined}
            className={cn(
              "flex h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              horizontal && "[&_svg]:hidden",
              iconOnly && "justify-center px-0",
              active
                ? "bg-accent text-accent-foreground"
                : "text-foreground/80 hover:bg-white/70 hover:text-foreground"
            )}
          >
            <Icon className={cn("h-[18px] w-[18px]", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
            <span className={iconOnly ? "sr-only" : undefined}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ venue }: { venue: ShellVenue }) {
  return (
    <div className="space-y-1 border-t border-border/70 px-3 py-4">
      <a
        href={`/v/${venue.slug}`}
        target="_blank"
        rel="noreferrer"
        className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground/80 hover:bg-white/70 hover:text-foreground"
      >
        <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden />
        View public page
      </a>
      {!venue.published && (
        <p className="px-3 text-xs text-warning">Not published yet — only you can preview it.</p>
      )}
    </div>
  );
}

function VenueSwitcher({ venue, venues, compact = false }: { venue: ShellVenue; venues: SwitcherVenue[]; compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn("inline-flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground shadow-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring", compact ? "max-w-[130px] text-xs sm:max-w-[16rem] sm:text-sm" : "max-w-[16rem]")}
      >
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: venue.brandColor }} />
        <span className="flex-1 truncate text-left">{venue.name}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-11 z-50 w-72 rounded-xl border border-border bg-card p-1.5 shadow-xl"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your venues
          </p>
          {venues.map((v) => (
            <Link
              key={v.slug}
              role="menuitem"
              href={`/app/${v.slug}`}
              onClick={close}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
            >
              <span className="truncate">{v.name}</span>
              {v.slug === venue.slug && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
            </Link>
          ))}
          <div className="my-1 h-px bg-border" />
          <Link
            role="menuitem"
            href="/app/new"
            onClick={close}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-primary hover:bg-muted"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create another venue
          </Link>
        </div>
      )}
    </div>
  );
}

function AccountMenu({ user, role }: { user: ShellUser; role: VenueRole }) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {user.name} · {ROLE_LABEL[role]}
        </span>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
          {initials(user.name)}
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-border bg-card p-1.5 shadow-xl">
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link role="menuitem" href="/app" onClick={close} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" aria-hidden />
            All venues
          </Link>
          {user.isSuperAdmin && (
            <Link role="menuitem" href="/admin" onClick={close} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
              Super admin
            </Link>
          )}
          <form action={signOutAction}>
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted">
              <LogOut className="h-4 w-4 text-muted-foreground" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function AppShell({
  venue,
  venues,
  user,
  role,
  children,
}: {
  venue: ShellVenue;
  venues: SwitcherVenue[];
  user: ShellUser;
  role: VenueRole;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const drawerRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = drawerRef.current;
    if (!el) return;
    if (drawerOpen && !el.open) el.showModal();
    if (!drawerOpen && el.open) el.close();
  }, [drawerOpen]);

  const pathname = usePathname();
  const isCalendar = pathname.startsWith(`/app/${venue.slug}/calendar`);
  const isRecords = ["bookings", "clients", "tours", "records", "emails"].some((segment) => pathname.startsWith(`/app/${venue.slug}/${segment}`));
  const owner = role === "OWNER" && !isCalendar && !isRecords;
  const brand = (
    <Link href="/app" className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-foreground">
      <span className="hidden h-9 w-9 items-center justify-center rounded-lg bg-primary text-white sm:inline-flex"><Building2 className="h-5 w-5" aria-hidden /></span>
      Venuora
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      {owner && (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[238px] flex-col border-r border-border bg-sidebar lg:flex">
          <div className="px-6 pt-7 pb-6">{brand}</div>
          <div className="mx-5 border-y border-border py-5">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Venue</p>
            <VenueSwitcher venue={venue} venues={venues} />
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6"><NavLinks venue={venue} role={role} /></div>
          <SidebarFooter venue={venue} />
          <div className="border-t border-border px-5 py-4"><AccountMenu user={user} role={role} /></div>
        </aside>
      )}

      {owner && <aside aria-label="Compact venue navigation" className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center border-r border-border bg-sidebar py-6 md:flex lg:hidden"><Link href="/app" aria-label="Venuora venues" className="mb-8 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white"><Building2 className="h-6 w-6" aria-hidden /></Link><div className="w-full px-3"><NavLinks venue={venue} role={role} iconOnly /></div></aside>}
      <div className={cn(owner && "md:pl-20 lg:pl-[238px]")}>
        <header className={cn("sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-4 sm:px-8 lg:px-10", (isCalendar || isRecords) ? "min-h-16" : "min-h-20")}>
          <button type="button" aria-label="Open menu" onClick={() => setDrawerOpen(true)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted lg:hidden"><Menu className="h-6 w-6" /></button>
          <div className={cn("min-w-0 lg:hidden", (isCalendar || isRecords) && "flex flex-1 items-center gap-2")}>
            <Link href="/app" className={cn("font-semibold tracking-tight", isCalendar ? "text-base text-primary" : "text-xl")}>Venuora</Link>
            <div className={cn("min-w-0", !isCalendar && !isRecords && "mt-1")}><VenueSwitcher venue={venue} venues={venues} compact={isCalendar || isRecords} /></div>
          </div>
          <div className="hidden min-w-0 items-center gap-4 lg:flex">
            {owner ? <><span className="text-sm text-muted-foreground">Owner workspace</span><ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" aria-hidden /><span className="truncate text-sm font-medium">{venue.name}</span></> : <>{brand}<span className="h-7 w-px bg-border" aria-hidden /><VenueSwitcher venue={venue} venues={venues} /></>}
          </div>
          {isRecords && <nav aria-label="Bookings and clients" className="hidden items-center gap-2 lg:flex">{NAV.filter((item) => ["emails", "bookings", "clients", "tours", ...(role === "STAFF" ? ["records"] : [])].includes(item.segment) && ROLE_RANK[role] >= ROLE_RANK[item.minRole]).map((item) => <Link key={item.segment} href={`/app/${venue.slug}/${item.segment}`} aria-current={pathname.startsWith(`/app/${venue.slug}/${item.segment}`) ? "page" : undefined} className={cn("inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", pathname.startsWith(`/app/${venue.slug}/${item.segment}`) ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}><item.icon className="h-4 w-4" />{item.label}</Link>)}</nav>}
          {isCalendar && <Link href={`/app/${venue.slug}/calendar`} aria-current="page" className="hidden self-stretch items-center border-b-2 border-primary px-4 text-sm font-medium text-primary sm:inline-flex">Calendar</Link>}
          <div className="ml-auto flex shrink-0 items-center gap-5">
            {(isCalendar || isRecords) && venue.timezone && <span className="hidden items-center gap-2 text-xs text-muted-foreground xl:inline-flex"><CalendarDays className="h-4 w-4" aria-hidden />{venue.timezone}</span>}
            {owner && venue.published && <a href={`/v/${venue.slug}`} target="_blank" rel="noreferrer" className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium shadow-xs hover:bg-muted xl:inline-flex"><ExternalLink className="h-4 w-4" aria-hidden />View public page</a>}
            <AccountMenu user={user} role={role} />
          </div>
        </header>
        {!owner && !isRecords && <div className="hidden border-b border-border bg-card px-8 py-2 lg:block"><div className="mx-auto max-w-[1480px]"><NavLinks venue={venue} role={role} horizontal /></div></div>}
        {children}
      </div>

      <dialog ref={drawerRef} onClose={() => setDrawerOpen(false)} onClick={(e) => e.target === drawerRef.current && setDrawerOpen(false)} aria-label="Venue navigation" className="m-0 h-dvh max-h-dvh w-[300px] max-w-[85vw] border-r border-border bg-sidebar p-0 backdrop:bg-[#1b1a22]/35">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 pt-5"><span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Current venue</span><button type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div>
          <div className="space-y-5 px-5 pb-5"><VenueSwitcher venue={venue} venues={venues} /><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">{initials(user.name)}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="text-xs text-muted-foreground">{ROLE_LABEL[role]}</p></div></div></div>
          <div className="flex-1 border-t border-border overflow-y-auto px-5 py-5"><NavLinks venue={venue} role={role} onNavigate={() => setDrawerOpen(false)} /></div>
          <SidebarFooter venue={venue} />
          <form action={signOutAction} className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"><button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-destructive hover:bg-danger-soft"><LogOut className="h-4 w-4" aria-hidden />Sign out</button></form>
        </div>
      </dialog>
    </div>
  );
}
