"use client";

// Booking popover: quick facts + "Move" (click-to-move and drag-drop both
// land here) with a reprice preview before anything changes.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ExternalLink, Phone, Users } from "lucide-react";
import {
  applyRescheduleAction,
  previewRescheduleAction,
  type ReschedulePreview,
} from "@/actions/booking";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { EVENT_TYPE_LABELS, SLOT_TYPE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { formatInVenueTz, venueDateStr } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { CalBooking, CalSpace, MoveTarget } from "./cal-shared";

export function BookingDialog({
  slug,
  timezone,
  currency,
  spaces,
  booking,
  movePrefill,
  canManage,
  onClose,
}: {
  slug: string;
  timezone: string;
  currency: string;
  spaces: CalSpace[];
  booking: CalBooking | null;
  movePrefill: MoveTarget | null;
  canManage: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={booking !== null} onClose={onClose} className="max-w-md">
      {booking !== null && (
        // key: fresh state per booking / per drag-drop target.
        <BookingDetails
          key={`${booking.id}:${movePrefill ? JSON.stringify(movePrefill) : ""}`}
          slug={slug}
          timezone={timezone}
          currency={currency}
          spaces={spaces}
          booking={booking}
          movePrefill={movePrefill}
          canManage={canManage}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function BookingDetails({
  slug,
  timezone,
  currency,
  spaces,
  booking,
  movePrefill,
  canManage,
  onClose,
}: {
  slug: string;
  timezone: string;
  currency: string;
  spaces: CalSpace[];
  booking: CalBooking;
  movePrefill: MoveTarget | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [move, setMove] = React.useState<MoveTarget>(() => {
    if (movePrefill) return movePrefill;
    const start = new Date(booking.start);
    const end = new Date(booking.end);
    return {
      spaceId: booking.spaceId,
      date: venueDateStr(start, timezone),
      startTime: formatInVenueTz(start, timezone, "HH:mm"),
      endTime: formatInVenueTz(end, timezone, "HH:mm"),
      endsNextDay: venueDateStr(end, timezone) !== venueDateStr(start, timezone),
    };
  });
  const [preview, setPreview] = React.useState<ReschedulePreview | null>(null);
  const [pending, setPending] = React.useState<"preview" | "apply" | null>(
    movePrefill && canManage ? "preview" : null
  );
  const [error, setError] = React.useState<string | null>(null);
  const [altSpaces, setAltSpaces] = React.useState<string[] | null>(null);

  // A drag-drop arrives with a prefilled target: preview it immediately.
  React.useEffect(() => {
    if (!movePrefill || !canManage) return;
    let cancelled = false;
    previewRescheduleAction(slug, booking.id, movePrefill)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) setError(res.error ?? "Could not price the new slot");
        else setPreview(res);
      })
      .catch(() => {
        if (!cancelled) setError("Something went wrong — try again.");
      })
      .finally(() => {
        if (!cancelled) setPending(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runPreview() {
    setPending("preview");
    setError(null);
    setPreview(null);
    try {
      const res = await previewRescheduleAction(slug, booking.id, move);
      if (!res.ok) setError(res.error ?? "Could not price the new slot");
      else setPreview(res);
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setPending(null);
    }
  }

  async function apply() {
    setPending("apply");
    setError(null);
    try {
      const res = await applyRescheduleAction(slug, booking.id, move);
      if (!res.ok) {
        setError(res.error);
        setAltSpaces("alternatives" in res ? (res.alternatives ?? null) : null);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setPending(null);
    }
  }

  const setTarget = (patch: Partial<MoveTarget>) => {
    setMove((m) => ({ ...m, ...patch }));
    setPreview(null); // any change invalidates the price preview
    setAltSpaces(null);
  };

  const sameDay =
    venueDateStr(new Date(booking.start), timezone) ===
    venueDateStr(new Date(booking.end), timezone);

  return (
    <div>
      <div className="mb-1 flex items-start justify-between gap-3">
        <DialogTitle className="mb-0">{booking.clientName}</DialogTitle>
        <StatusBadge status={booking.status} />
      </div>
      <p className="mb-4 text-sm text-zinc-500">
        {EVENT_TYPE_LABELS[booking.eventType]} · {SLOT_TYPE_LABELS[booking.slotType]} ·{" "}
        {booking.spaceName}
      </p>

      <div className="space-y-2 text-sm text-zinc-700">
        <p>
          {formatInVenueTz(new Date(booking.start), timezone, "EEE, MMM d yyyy · h:mm a")} –{" "}
          {formatInVenueTz(new Date(booking.end), timezone, sameDay ? "h:mm a" : "EEE h:mm a")}
          <span className="ml-2 inline-flex items-center gap-1 text-zinc-500">
            <Users className="h-3.5 w-3.5" />
            {booking.guestCount}
          </span>
        </p>
        {booking.clientPhone && (
          <p>
            <a
              href={`tel:${booking.clientPhone}`}
              className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" />
              {booking.clientPhone}
            </a>
          </p>
        )}
        <p className="text-zinc-600">
          Total{" "}
          <span className="font-semibold text-zinc-900">
            {formatMoney(booking.totalCents, currency)}
          </span>
          {" · "}Deposit{" "}
          <span className="font-semibold text-zinc-900">
            {formatMoney(booking.depositCents, currency)}
          </span>
        </p>
        <Link
          href={`/app/${slug}/bookings/${booking.id}`}
          className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:underline"
        >
          Open booking
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {canManage && (
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Move this booking</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="mv-space">Space</Label>
              <Select
                id="mv-space"
                value={move.spaceId}
                onChange={(e) => setTarget({ spaceId: e.target.value })}
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="mv-date">Date</Label>
              <Input
                id="mv-date"
                type="date"
                value={move.date}
                onChange={(e) => setTarget({ date: e.target.value })}
              />
            </div>
            <label className="flex items-end gap-2 pb-2.5 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 accent-indigo-600"
                checked={move.endsNextDay}
                onChange={(e) => setTarget({ endsNextDay: e.target.checked })}
              />
              Ends next day
            </label>
            <div>
              <Label htmlFor="mv-start">Start</Label>
              <Input
                id="mv-start"
                type="time"
                step={900}
                value={move.startTime}
                onChange={(e) => setTarget({ startTime: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="mv-end">End</Label>
              <Input
                id="mv-end"
                type="time"
                step={900}
                value={move.endTime}
                onChange={(e) => setTarget({ endTime: e.target.value })}
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <p>{error}</p>
              {altSpaces && altSpaces.length > 0 && (
                <p className="mt-1 text-xs">Free at that time: {altSpaces.join(", ")}</p>
              )}
            </div>
          )}

          {preview?.ok && (
            <div
              className={cn(
                "mt-3 rounded-lg px-3 py-2 text-sm",
                preview.priceChanged
                  ? "bg-amber-50 text-amber-800"
                  : "bg-emerald-50 text-emerald-800"
              )}
            >
              {preview.priceChanged ? (
                <p className="flex flex-wrap items-center gap-1.5">
                  Price changes:
                  <span className="line-through opacity-70">
                    {formatMoney(preview.oldTotalCents ?? 0, currency)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span className="font-semibold">
                    {formatMoney(preview.newTotalCents ?? 0, currency)}
                  </span>
                </p>
              ) : (
                <p>
                  Price unchanged — {formatMoney(preview.newTotalCents ?? 0, currency)}. Confirm
                  to move.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {preview?.ok ? (
              <Button className="flex-1" disabled={pending !== null} onClick={apply}>
                {pending === "apply" ? "Moving…" : "Confirm move"}
              </Button>
            ) : (
              <Button
                className="flex-1"
                variant="secondary"
                disabled={pending !== null}
                onClick={runPreview}
              >
                {pending === "preview" ? "Checking…" : "Preview move"}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
