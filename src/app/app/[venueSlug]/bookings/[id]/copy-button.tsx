"use client";

import * as React from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** "Copy to clipboard" button with a transient "Copied" state and an optional toast. */
export function CopyButton({
  value,
  label = "Copy",
  toastMessage,
  icon = "copy",
  variant = "outline",
  size = "sm",
  className,
}: {
  value: string;
  label?: string;
  toastMessage?: string;
  /** A name, not a component: server pages render this button and can only pass plain values. */
  icon?: "copy" | "link";
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const Icon = icon === "link" ? Link2 : Copy;
  const [copied, setCopied] = React.useState(false);
  const toast = useToast();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          if (toastMessage) toast(toastMessage);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard unavailable (http, permissions) — select-and-copy fallback
          window.prompt("Copy this link:", value);
        }
      }}
    >
      {copied ? (
        <Check className="h-4 w-4 text-success" aria-hidden />
      ) : (
        <Icon className="h-4 w-4" aria-hidden />
      )}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}
