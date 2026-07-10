"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { TourStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { setTourStatusAction } from "@/actions/tours";

export function TourButtons({
  slug,
  tourId,
  status,
}: {
  slug: string;
  tourId: string;
  status: TourStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  const setStatus = async (
    next: "CONFIRMED" | "DECLINED" | "COMPLETED" | "CANCELLED"
  ) => {
    setBusy(next);
    try {
      await setTourStatusAction(slug, tourId, next);
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  if (status === "PENDING") {
    return (
      <div className="flex gap-2">
        <Button size="sm" variant="success" disabled={busy !== null} onClick={() => setStatus("CONFIRMED")}>
          {busy === "CONFIRMED" ? "Confirming…" : "Confirm"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setStatus("DECLINED")}>
          {busy === "DECLINED" ? "Declining…" : "Decline"}
        </Button>
      </div>
    );
  }

  if (status === "CONFIRMED") {
    return (
      <div className="flex gap-2">
        <Button size="sm" disabled={busy !== null} onClick={() => setStatus("COMPLETED")}>
          {busy === "COMPLETED" ? "Saving…" : "Mark completed"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setStatus("CANCELLED")}>
          {busy === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      </div>
    );
  }

  return null;
}
