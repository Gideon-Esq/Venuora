import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "danger" | "success" | "neutral";

const TONES: Record<Tone, { box: string; icon: LucideIcon; iconClass: string }> = {
  info: { box: "border-accent bg-accent/60 text-accent-foreground", icon: Info, iconClass: "text-primary" },
  warning: { box: "border-warning-border bg-warning-soft text-warning", icon: AlertTriangle, iconClass: "text-warning" },
  danger: { box: "border-destructive/20 bg-danger-soft text-destructive", icon: OctagonAlert, iconClass: "text-destructive" },
  success: { box: "border-success/20 bg-success-soft text-success", icon: CheckCircle2, iconClass: "text-success" },
  neutral: { box: "border-border bg-muted text-foreground", icon: Info, iconClass: "text-muted-foreground" },
};

/** Inline message box. Errors get role="alert" so screen readers announce them. */
export function Callout({
  tone = "info",
  title,
  children,
  action,
  icon,
  className,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon | null;
  className?: string;
}) {
  const t = TONES[tone];
  const Icon = icon === null ? null : (icon ?? t.icon);
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", t.box, className)}
    >
      {Icon && <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.iconClass)} aria-hidden />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "leading-relaxed")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
