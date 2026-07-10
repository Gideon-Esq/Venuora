"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { seg: "", label: "General" },
  { seg: "policies", label: "Policies" },
  { seg: "branding", label: "Branding" },
  { seg: "payments", label: "Payments" },
  { seg: "billing", label: "Billing" },
  { seg: "team", label: "Team" },
];

export function SettingsNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/app/${slug}/settings`;

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Settings sections">
      {ITEMS.map((item) => {
        const href = item.seg ? `${base}/${item.seg}` : base;
        const active = pathname === href;
        return (
          <Link
            key={item.seg}
            href={href}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium",
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
