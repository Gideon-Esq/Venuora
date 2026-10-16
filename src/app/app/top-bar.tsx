import * as React from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** Simple top bar for screens outside the venue shell (/app, /app/new). */
export function AppTopBar({ userName, children }: { userName: string; children?: React.ReactNode }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-8">
        <span className="text-lg font-semibold tracking-tight text-foreground">Venuora</span>
        <span aria-hidden className="hidden h-6 w-px bg-border sm:block" />
        <span className="hidden text-sm text-muted-foreground sm:block">Venue management</span>
        {children}
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <span className="hidden truncate text-sm text-muted-foreground sm:block">{userName}</span>
          <span
            aria-hidden
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {initials(userName)}
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
