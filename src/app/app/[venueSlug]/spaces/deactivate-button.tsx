"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarCheck, CalendarX, Globe, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { deactivateSpaceAction } from "@/actions/space";

const CONSEQUENCES = [
  { icon: Globe, title: "Public page", detail: "No longer visible to clients" },
  { icon: CalendarX, title: "New bookings", detail: "Instant and request bookings are blocked" },
  { icon: CalendarCheck, title: "Existing bookings", detail: "Remain confirmed and unchanged" },
];

/**
 * Deactivate trigger + confirmation dialog.
 * - `appearance="text"`: compact red text button for table rows.
 * - `appearance="outline"`: destructive-outline button for page headers.
 * - `appearance="solid"`: filled destructive button for the danger-zone card.
 */
export function DeactivateSpaceButton({
  slug,
  spaceId,
  spaceName,
  appearance = "solid",
  redirectToList = true,
  className,
}: {
  slug: string;
  spaceId: string;
  spaceName: string;
  appearance?: "text" | "outline" | "solid";
  redirectToList?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [ack, setAck] = React.useState(false);

  const trigger =
    appearance === "text" ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn("text-destructive hover:bg-danger-soft hover:text-destructive", className)}
        aria-label={`Deactivate ${spaceName}`}
      >
        Deactivate
      </Button>
    ) : (
      <Button
        type="button"
        variant={appearance === "outline" ? "destructive-outline" : "destructive"}
        onClick={() => setOpen(true)}
        className={className}
      >
        <Power className="h-4 w-4" aria-hidden />
        {appearance === "outline" ? "Deactivate" : "Deactivate space"}
      </Button>
    );

  return (
    <>
      {trigger}
      <Dialog
        open={open}
        onClose={() => {
          if (busy) return;
          setOpen(false);
          setAck(false);
        }}
      >
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-destructive">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </span>
        <DialogTitle className="text-xl">Deactivate {spaceName}?</DialogTitle>
        <DialogDescription>
          This will hide the space from your public page and stop new bookings.
        </DialogDescription>
        <ul className="space-y-2.5">
          {CONSEQUENCES.map(({ icon: Icon, title, detail }) => (
            <li key={title} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3.5">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-[13px] text-muted-foreground">{detail}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[13px] text-muted-foreground">
          Reactivating a space isn&apos;t available in the app yet.
        </p>
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border-input accent-destructive"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            disabled={busy}
          />
          I understand existing bookings will not be affected
        </label>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
              setAck(false);
            }}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy || !ack}
            onClick={async () => {
              setBusy(true);
              try {
                await deactivateSpaceAction(slug, spaceId);
                toast(`${spaceName} is now inactive.`);
                setOpen(false);
                setAck(false);
                if (redirectToList) router.push(`/app/${slug}/spaces`);
                router.refresh();
              } catch {
                toast("Couldn't deactivate the space. Please try again.", "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deactivating…" : "Deactivate space"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
