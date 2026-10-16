// Small presentational pieces shared by the month grid, timeline, agenda and
// legend so every calendar surface speaks the same visual language:
// status → tone (colour + icon), space → a small coloured dot only.

import * as React from "react";
import {
  Check,
  CheckCheck,
  CircleDashed,
  Clock,
  Send,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { BookingStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const STATUS_ICON: Partial<Record<BookingStatus, LucideIcon>> = {
  CONFIRMED: Check,
  PENCILED: Clock,
  HOLD: Clock,
  INQUIRY: CircleDashed,
  QUOTE_SENT: Send,
  COMPLETED: CheckCheck,
  NO_SHOW: UserX,
};

/** Status icon for chips/bars (decorative — the status is also in the label). */
export function StatusIcon({ status, className }: { status: BookingStatus; className?: string }) {
  const Icon = STATUS_ICON[status] ?? CircleDashed;
  return <Icon aria-hidden className={cn("h-3.5 w-3.5 shrink-0", className)} />;
}

export function SpaceDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10", className)}
      style={{ backgroundColor: color }}
    />
  );
}

/** Diagonal hatch used for setup/teardown buffers. */
export function hatchStyle(hex: string): React.CSSProperties {
  return {
    backgroundColor: `${hex}14`,
    backgroundImage: `repeating-linear-gradient(45deg, ${hex}73 0 3px, transparent 3px 7px)`,
  };
}
