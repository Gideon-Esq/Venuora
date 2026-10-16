import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Ban,
  CheckCircle2,
  Circle,
  CircleCheck,
  Clock,
  Hourglass,
  PencilLine,
  Send,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/generated/prisma/enums";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/labels";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium [&_svg]:h-3 [&_svg]:w-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-border bg-card text-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        accent: "bg-accent text-accent-foreground",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-destructive",
        muted: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "secondary" },
  }
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_ICONS: Record<BookingStatus, LucideIcon> = {
  INQUIRY: Circle,
  QUOTE_SENT: Send,
  HOLD: Hourglass,
  PENCILED: PencilLine,
  CONFIRMED: CircleCheck,
  COMPLETED: CheckCircle2,
  CANCELLED: Ban,
  NO_SHOW: UserX,
  EXPIRED: Clock,
};

/** Booking status chip: always icon + text, never colour alone. */
export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge variant={STATUS_TONES[status]} className={className}>
      <Icon aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export { badgeVariants };
