import * as React from "react";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/generated/prisma/enums";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/labels";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return <Badge className={cn(STATUS_STYLES[status], className)}>{STATUS_LABELS[status]}</Badge>;
}
