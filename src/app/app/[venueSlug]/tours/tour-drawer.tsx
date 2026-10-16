"use client";

// Tour request side drawer + the status actions, shared by the Tours page and
// the dashboard's "Pending tours" card.
import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Mail, MapPin, Phone, StickyNote } from "lucide-react";
import { setTourStatusAction } from "@/actions/tours";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { TOUR_STATUS_LABELS, TOUR_STATUS_VARIANTS, type TourView } from "./tour-shared";

type NextStatus = "CONFIRMED" | "DECLINED" | "COMPLETED" | "CANCELLED";

const SUCCESS_COPY: Record<NextStatus, (name: string) => string> = {
  CONFIRMED: (n) => `Tour confirmed — we emailed ${n} the details.`,
  DECLINED: (n) => `Tour request from ${n} declined.`,
  COMPLETED: (n) => `Tour with ${n} marked completed.`,
  CANCELLED: (n) => `Tour with ${n} cancelled.`,
};

const BUSY_COPY: Record<NextStatus, string> = {
  CONFIRMED: "Confirming…",
  DECLINED: "Declining…",
  COMPLETED: "Saving…",
  CANCELLED: "Cancelling…",
};

/** Runs setTourStatusAction with a toast and a refresh of the current page. */
export function useTourStatus(slug: string) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState<{ id: string; status: NextStatus } | null>(null);

  const run = React.useCallback(
    async (tour: Pick<TourView, "id" | "name">, status: NextStatus): Promise<boolean> => {
      setBusy({ id: tour.id, status });
      try {
        await setTourStatusAction(slug, tour.id, status);
        toast(SUCCESS_COPY[status](tour.name));
        router.refresh();
        return true;
      } catch {
        toast("Couldn't update this tour. Please try again.", "error");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [router, slug, toast]
  );

  return { run, busy };
}

export function TourStatusBadge({ status, className }: { status: TourView["status"]; className?: string }) {
  return (
    <Badge variant={TOUR_STATUS_VARIANTS[status]} className={className}>
      {status === "CONFIRMED" && <Check aria-hidden />}
      {TOUR_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Inline row actions (Tours page). Returns null when there is nothing to do. */
export function TourActions({
  tour,
  tourStatus,
  emphasizeComplete = false,
}: {
  tour: TourView;
  tourStatus: ReturnType<typeof useTourStatus>;
  emphasizeComplete?: boolean;
}) {
  const { run, busy } = tourStatus;
  const isBusy = busy?.id === tour.id;
  const label = (s: NextStatus, idle: string) => (isBusy && busy?.status === s ? BUSY_COPY[s] : idle);

  if (tour.status === "PENDING") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={isBusy} onClick={() => run(tour, "CONFIRMED")} className="max-md:h-10">
          <Check className="h-4 w-4" aria-hidden />
          {label("CONFIRMED", "Confirm")}
        </Button>
        <Button size="sm" variant="outline" disabled={isBusy} onClick={() => run(tour, "DECLINED")} className="max-md:h-10">
          {label("DECLINED", "Decline")}
        </Button>
      </div>
    );
  }
  if (tour.status === "CONFIRMED") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={emphasizeComplete ? "default" : "outline"}
          disabled={isBusy}
          onClick={() => run(tour, "COMPLETED")}
          className="max-md:h-10"
        >
          {label("COMPLETED", "Mark completed")}
        </Button>
        <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => run(tour, "CANCELLED")} className="max-md:h-10">
          {label("CANCELLED", "Cancel tour")}
        </Button>
      </div>
    );
  }
  return null;
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words text-[15px] font-medium text-foreground">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Right-side drawer with a tour's details. Managers+ get the status actions
 * in the footer; Staff see it read-only.
 */
export function TourDrawer({
  tour,
  onClose,
  canManage,
  tourStatus,
}: {
  tour: TourView | null;
  onClose: () => void;
  canManage: boolean;
  tourStatus: ReturnType<typeof useTourStatus>;
}) {
  const [confirmClose, setConfirmClose] = React.useState<"DECLINED" | "CANCELLED" | null>(null);
  const [lastTourId, setLastTourId] = React.useState(tour?.id);
  if (lastTourId !== tour?.id) {
    setLastTourId(tour?.id);
    setConfirmClose(null);
  }
  const t = tour;
  const { run, busy } = tourStatus;
  const isBusy = !!t && busy?.id === t.id;

  const act = async (status: NextStatus) => {
    if (!t) return;
    const ok = await run(t, status);
    if (ok) { setConfirmClose(null); onClose(); }
  };

  return (
    <Dialog open={!!tour} onClose={onClose} ariaLabel={tour ? `Tour request from ${tour.name}` : "Tour request"} variant="drawer" className="sm:max-w-md">
      {t && (
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-6 pb-5 pt-6">
            <p className="text-sm text-muted-foreground">Tour request</p>
            <h2 className="mt-1 pr-10 text-xl font-semibold tracking-tight text-foreground">{t.name}</h2>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div className="flex flex-wrap items-center gap-2">
              <TourStatusBadge status={t.status} />
              {t.isPast && (t.status === "PENDING" || t.status === "CONFIRMED") && (
                <Badge variant="muted">Requested time has passed</Badge>
              )}
            </div>

            <dl className="space-y-5">
              <DetailRow icon={CalendarClock} label="Requested time">
                {t.when}
                <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                  {t.whenLong} · 30-minute viewing
                </span>
              </DetailRow>
              <DetailRow icon={Mail} label="Email">
                <a href={`mailto:${t.email}`} className="text-primary underline-offset-4 hover:underline">
                  {t.email}
                </a>
              </DetailRow>
              {t.phone && (
                <DetailRow icon={Phone} label="Phone">
                  <a href={`tel:${t.phone}`} className="text-primary underline-offset-4 hover:underline">
                    {t.phone}
                  </a>
                </DetailRow>
              )}
              <DetailRow icon={MapPin} label="Requested space">
                {t.spaceName ?? <span className="font-normal text-muted-foreground">Any space</span>}
              </DetailRow>
              {t.notes && (
                <DetailRow icon={StickyNote} label="Notes">
                  <span className="whitespace-pre-line font-normal">{t.notes}</span>
                </DetailRow>
              )}
            </dl>
          </div>

          {canManage && (t.status === "PENDING" || t.status === "CONFIRMED") && (
            <div className="space-y-3 border-t border-border px-6 py-5">
              {confirmClose ? <div role="group" aria-label="Confirm tour decision" className="rounded-lg border border-warning-border bg-warning-soft p-4"><p className="text-sm font-medium">{confirmClose === "DECLINED" ? "Decline this request?" : "Cancel this tour?"}</p><p className="mt-1 text-sm text-muted-foreground">This visit will be removed from the active schedule.</p><div className="mt-4 flex flex-wrap gap-2"><Button variant="destructive" disabled={isBusy} onClick={() => act(confirmClose)}>{isBusy ? BUSY_COPY[confirmClose] : "Yes, continue"}</Button><Button variant="outline" disabled={isBusy} onClick={() => setConfirmClose(null)}>Keep tour</Button></div></div> : t.status === "PENDING" ? (
                <>
                  <Button className="w-full" disabled={isBusy} onClick={() => act("CONFIRMED")}>
                    {isBusy && busy?.status === "CONFIRMED" ? BUSY_COPY.CONFIRMED : "Confirm tour"}
                  </Button>
                  <Button variant="outline" className="w-full" disabled={isBusy} onClick={() => setConfirmClose("DECLINED")}>
                    {isBusy && busy?.status === "DECLINED" ? BUSY_COPY.DECLINED : "Decline"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Confirming emails {t.name} the date and time.
                  </p>
                </>
              ) : (
                <>
                  <Button
                    className="w-full"
                    variant={t.isPast ? "default" : "outline"}
                    disabled={isBusy}
                    onClick={() => act("COMPLETED")}
                  >
                    {isBusy && busy?.status === "COMPLETED" ? BUSY_COPY.COMPLETED : "Mark completed"}
                  </Button>
                  <Button variant="ghost" className="w-full" disabled={isBusy} onClick={() => setConfirmClose("CANCELLED")}>
                    {isBusy && busy?.status === "CANCELLED" ? BUSY_COPY.CANCELLED : "Cancel tour"}
                  </Button>
                </>
              )}
            </div>
          )}
          {!canManage && t.status === "PENDING" && (
            <p className="border-t border-border px-6 py-5 text-sm text-muted-foreground">
              A manager or owner can confirm or decline this request.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
