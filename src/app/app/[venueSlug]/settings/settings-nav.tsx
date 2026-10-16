"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  FileText,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { seg: "", label: "General", icon: SlidersHorizontal },
  { seg: "general", label: "Venue details", icon: Building2 },
  { seg: "policies", label: "Policies", icon: FileText },
  { seg: "branding", label: "Branding", icon: Palette },
  { seg: "payments", label: "Payments", icon: CreditCard },
  { seg: "billing", label: "Billing", icon: Sparkles },
  { seg: "team", label: "Team", icon: Users },
];

export function SettingsNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/app/${slug}/settings`;

  return (
    <nav aria-label="Settings sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:overflow-visible">
      <p className="mb-2 hidden px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:block">
        Settings
      </p>
      <Link href={`/app/${slug}/onboarding`} className="mb-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-primary hover:bg-accent"><Sparkles className="h-4 w-4" />Setup checklist</Link>
      <ul className="flex min-w-max gap-1 border-b border-border lg:min-w-0 lg:flex-col lg:border-b-0">
        {ITEMS.map((item) => {
          const href = item.seg ? `${base}/${item.seg}` : base;
          const active = item.seg ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
          const Icon = item.icon;
          return (
            <li key={item.seg}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center gap-2 whitespace-nowrap px-3 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  "-mb-px border-b-2 lg:mb-0 lg:flex lg:w-full lg:rounded-lg lg:border-b-0",
                  active
                    ? "border-primary text-foreground lg:bg-accent lg:text-accent-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground lg:hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
