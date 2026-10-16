"use client";

// Accessible modal on the native <dialog> element (focus containment, Esc and
// backdrop close come from the platform). `variant="drawer"` slides in from
// the right edge for side-panel flows (e.g. a generated payment link).
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const DialogTitleId = React.createContext<string | undefined>(undefined);

export function Dialog({
  open,
  onClose,
  children,
  className,
  variant = "modal",
  showClose = true,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  variant?: "modal" | "drawer";
  showClose?: boolean;
  ariaLabel?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const [hasTitle, setHasTitle] = React.useState(false);
  React.useEffect(() => { setHasTitle(!!ref.current?.querySelector(`[id="${CSS.escape(titleId)}"]`)); }, [open, children, titleId]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={ariaLabel ?? (hasTitle ? undefined : "Dialog")}
      aria-labelledby={!ariaLabel && hasTitle ? titleId : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className={cn(
        "border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-[#1b1a22]/35",
        variant === "modal" && "m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl",
        variant === "drawer" &&
          "my-0 ml-auto mr-0 h-dvh max-h-dvh w-full max-w-[36rem] rounded-none border-y-0 border-r-0",
        className
      )}
    >
      <div className={cn("relative overflow-y-auto", variant === "modal" ? "max-h-[85vh] p-6" : "h-full")}>
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <DialogTitleId.Provider value={titleId}>{children}</DialogTitleId.Provider>
      </div>
    </dialog>
  );
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const titleId = React.useContext(DialogTitleId);
  return (
    <h2 id={titleId} className={cn("mb-1 pr-8 text-lg font-semibold tracking-tight text-foreground", className)} {...props} />
  );
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mb-5 text-sm text-muted-foreground", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex flex-wrap justify-end gap-2", className)} {...props} />;
}
