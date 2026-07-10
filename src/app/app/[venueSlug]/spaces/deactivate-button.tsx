"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { deactivateSpaceAction } from "@/actions/space";

export function DeactivateSpaceButton({
  slug,
  spaceId,
  spaceName,
}: {
  slug: string;
  spaceId: string;
  spaceName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Deactivate space
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Deactivate {spaceName}?</DialogTitle>
        <DialogDescription>
          The space is hidden from your public page and can&apos;t take new bookings. Existing
          bookings stay exactly as they are. You can reach out to support to reactivate it later.
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep it active
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await deactivateSpaceAction(slug, spaceId);
              router.push(`/app/${slug}/spaces`);
              router.refresh();
            }}
          >
            {busy ? "Deactivating…" : "Yes, deactivate"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
