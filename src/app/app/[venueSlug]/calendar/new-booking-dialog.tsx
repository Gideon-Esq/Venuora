"use client";

// The FAST PHONE BOOKING form — target: filled in under 45 seconds while the
// caller is on the line. Four exits: inquiry, quote, pencil hold, confirm.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { createPhoneBookingAction, type PhoneBookingResult } from "@/actions/booking";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { EVENT_TYPE_LABELS, SLOT_TYPE_LABELS } from "@/lib/labels";
import { formatInVenueTz, venueDateStr } from "@/lib/time";
import { shortDate, type CalSpace } from "./cal-shared";

export interface NewBookingPrefill {
  date: string;
  spaceId?: string;
  startTime?: string;
  endTime?: string;
  endsNextDay?: boolean;
}

type SubmitAction = "INQUIRY" | "QUOTE" | "PENCIL" | "CONFIRM";

export function NewBookingDialog({
  slug,
  timezone,
  spaces,
  prefill,
  onClose,
}: {
  slug: string;
  timezone: string;
  spaces: CalSpace[];
  prefill: NewBookingPrefill | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={prefill !== null} onClose={onClose} className="max-w-xl">
      {prefill !== null && (
        // key: fresh form state every time the dialog opens (prefill objects
        // are created per click, so identity changes each open).
        <NewBookingForm
          key={JSON.stringify(prefill)}
          slug={slug}
          timezone={timezone}
          spaces={spaces}
          prefill={prefill}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function NewBookingForm({
  slug,
  timezone,
  spaces,
  prefill,
  onClose,
}: {
  slug: string;
  timezone: string;
  spaces: CalSpace[];
  prefill: NewBookingPrefill;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState(() => ({
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    spaceId: prefill.spaceId ?? spaces[0]?.id ?? "",
    eventType: "OTHER",
    slotType: "HOURLY",
    date: prefill.date,
    startTime: prefill.startTime ?? "18:00",
    endTime: prefill.endTime ?? "22:00",
    endsNextDay: prefill.endsNextDay ?? false,
    guestCount: "50",
    notes: "",
    pencilDays: "5",
  }));
  const [pending, setPending] = React.useState<SubmitAction | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [alternatives, setAlternatives] = React.useState<
    NonNullable<Extract<PhoneBookingResult, { ok: false }>["alternatives"]> | null
  >(null);
  const [depositUrl, setDepositUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(action: SubmitAction) {
    if (!form.clientName.trim()) return setError("Enter the caller's name");
    if (form.clientPhone.trim().length < 5) return setError("Enter a phone number");
    if (!form.spaceId) return setError("Pick a space");

    setError(null);
    setAlternatives(null);
    setPending(action);
    try {
      const res = await createPhoneBookingAction(slug, {
        clientName: form.clientName.trim(),
        clientPhone: form.clientPhone.trim(),
        clientEmail: form.clientEmail.trim(),
        spaceId: form.spaceId,
        eventType: form.eventType,
        slotType: form.slotType,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        endsNextDay: form.endsNextDay,
        guestCount: Math.max(0, Number(form.guestCount) || 0),
        addOns: [],
        notes: form.notes.trim(),
        action,
        pencilDays: Math.min(30, Math.max(1, Number(form.pencilDays) || 5)),
      });
      if (!res.ok) {
        setError(res.error);
        setAlternatives(res.alternatives ?? null);
        return;
      }
      router.refresh();
      if (action === "CONFIRM" && res.depositUrl) {
        setDepositUrl(res.depositUrl);
      } else {
        onClose();
      }
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setPending(null);
    }
  }

  async function copyLink() {
    if (!depositUrl) return;
    try {
      await navigator.clipboard.writeText(depositUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the link is selectable */
    }
  }

  // Success panel after CONFIRM: hand the caller the payment link.
  if (depositUrl) {
    return (
      <div>
        <DialogTitle>Booking confirmed</DialogTitle>
        <DialogDescription>
          The slot is locked in. Text/WhatsApp this deposit link to the caller — the
          booking is fully confirmed once they pay.
        </DialogDescription>
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
          <p className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-700">{depositUrl}</p>
          <Button size="sm" variant={copied ? "success" : "default"} onClick={copyLink}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <Button variant="secondary" className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div>
      <DialogTitle>New booking</DialogTitle>
      <DialogDescription>
        Fill this while the caller is on the line — pick an exit below.
      </DialogDescription>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nb-name">Client name</Label>
            <Input
              id="nb-name"
              value={form.clientName}
              onChange={(e) => set("clientName", e.target.value)}
              placeholder="Ada Okafor"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="nb-phone">Phone</Label>
            <Input
              id="nb-phone"
              type="tel"
              value={form.clientPhone}
              onChange={(e) => set("clientPhone", e.target.value)}
              placeholder="+1 555 010 2030"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="nb-email">Email (optional)</Label>
          <Input
            id="nb-email"
            type="email"
            value={form.clientEmail}
            onChange={(e) => set("clientEmail", e.target.value)}
            placeholder="ada@example.com"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nb-space">Space</Label>
            <Select
              id="nb-space"
              value={form.spaceId}
              onChange={(e) => set("spaceId", e.target.value)}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="nb-event">Event type</Label>
            <Select
              id="nb-event"
              value={form.eventType}
              onChange={(e) => set("eventType", e.target.value)}
            >
              {Object.entries(EVENT_TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nb-slot">Slot</Label>
            <Select
              id="nb-slot"
              value={form.slotType}
              onChange={(e) => set("slotType", e.target.value)}
            >
              {Object.entries(SLOT_TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="nb-date">Date</Label>
            <Input
              id="nb-date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="nb-start">Start</Label>
            <Input
              id="nb-start"
              type="time"
              step={900}
              value={form.startTime}
              onChange={(e) => set("startTime", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="nb-end">End</Label>
            <Input
              id="nb-end"
              type="time"
              step={900}
              value={form.endTime}
              onChange={(e) => set("endTime", e.target.value)}
            />
          </div>
          <label className="flex items-end gap-2 pb-2.5 text-sm text-zinc-700 sm:items-center sm:pb-0 sm:pt-6">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300 accent-indigo-600"
              checked={form.endsNextDay}
              onChange={(e) => set("endsNextDay", e.target.checked)}
            />
            Ends next day
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nb-guests">Guest count</Label>
            <Input
              id="nb-guests"
              type="number"
              min={0}
              value={form.guestCount}
              onChange={(e) => set("guestCount", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="nb-notes">Notes</Label>
            <Textarea
              id="nb-notes"
              className="min-h-10"
              rows={1}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Anything to remember"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <p>{error}</p>
            {alternatives && (
              <div className="mt-2 space-y-2 text-rose-800">
                {alternatives.spaces.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium">Free spaces:</span>
                    {alternatives.spaces.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          set("spaceId", s.id);
                          setError(null);
                          setAlternatives(null);
                        }}
                        className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium shadow-sm ring-1 ring-inset ring-rose-200 hover:bg-rose-100"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
                {alternatives.dates.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium">Free dates (same time):</span>
                    {alternatives.dates.map((iso) => {
                      const d = venueDateStr(new Date(iso), timezone);
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => {
                            set("date", d);
                            setError(null);
                            setAlternatives(null);
                          }}
                          title={formatInVenueTz(new Date(iso), timezone)}
                          className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium shadow-sm ring-1 ring-inset ring-rose-200 hover:bg-rose-100"
                        >
                          {shortDate(d)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* The four exits */}
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pending !== null}
            onClick={() => submit("INQUIRY")}
          >
            {pending === "INQUIRY" ? "Saving…" : "Log inquiry"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending !== null}
            onClick={() => submit("QUOTE")}
          >
            {pending === "QUOTE" ? "Sending…" : "Send quote"}
          </Button>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={pending !== null}
              onClick={() => submit("PENCIL")}
            >
              {pending === "PENCIL" ? "Holding…" : "Pencil hold"}
            </Button>
            <Input
              aria-label="Pencil hold days"
              type="number"
              min={1}
              max={30}
              className="h-8 w-14 px-2 text-xs"
              value={form.pencilDays}
              onChange={(e) => set("pencilDays", e.target.value)}
            />
            <span className="text-xs text-zinc-500">days</span>
          </div>
          <Button size="sm" disabled={pending !== null} onClick={() => submit("CONFIRM")}>
            {pending === "CONFIRM" ? "Confirming…" : "Confirm + deposit link"}
          </Button>
        </div>
      </div>
    </div>
  );
}
