"use client";

// The FAST PHONE BOOKING form — target: filled in under 45 seconds while the
// caller is on the line. Four exits: inquiry, quote, pencil hold, confirm.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  MapPin,
  MessageSquare,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { createPhoneBookingAction, previewPhoneBookingAction, type PhoneBookingResult } from "@/actions/booking";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_LABELS, SLOT_TYPE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { formatInVenueTz, venueDateStr } from "@/lib/time";
import { shortDate, targetRange, type CalSpace } from "./cal-shared";

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
  // The confirmed state needs more room (two summary cards side by side).
  const [wide, setWide] = React.useState(false);
  const close = () => {
    setWide(false);
    onClose();
  };
  return (
    // Side drawer (revised design): the calendar stays visible behind the
    // form and its success states.
    <Dialog
      open={prefill !== null}
      onClose={close}
      variant="drawer"
      className={wide ? "max-w-[64rem]" : "max-w-[36rem]"}
    >
      {prefill !== null && (
        <div className="min-h-full p-5 sm:p-7">
        {/* key: fresh form state every time the dialog opens (prefill objects
            are created per click, so identity changes each open). */}
        <NewBookingForm
          key={JSON.stringify(prefill)}
          slug={slug}
          timezone={timezone}
          spaces={spaces}
          prefill={prefill}
          onConfirmed={() => setWide(true)}
          onClose={close}
        />
        </div>
      )}
    </Dialog>
  );
}

function NewBookingForm({
  slug,
  timezone,
  spaces,
  prefill,
  onConfirmed,
  onClose,
}: {
  slug: string;
  timezone: string;
  spaces: CalSpace[];
  prefill: NewBookingPrefill;
  onConfirmed: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<"clientName" | "clientPhone" | "spaceId" | "endTime" | "guestCount" | "clientEmail", string>>
  >({});
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
  const [confirmed, setConfirmed] = React.useState<{ bookingId: string; depositUrl: string } | null>(
    null
  );
  // Success view after INQUIRY / QUOTE / PENCIL.
  const [logged, setLogged] = React.useState<{
    action: Exclude<SubmitAction, "CONFIRM">;
    bookingId: string;
    email: string;
    holdUntil: number | null;
  } | null>(null);

  const [chosen, setChosen] = React.useState<SubmitAction>("INQUIRY");
  const [financial, setFinancial] = React.useState<{ totalCents: number; depositCents: number; currency: string } | null>(null);
  const [live, setLive] = React.useState<Awaited<ReturnType<typeof previewPhoneBookingAction>> | null>(null);
  const space = spaces.find((item) => item.id === form.spaceId);
  const capacity = Math.max(space?.seatedCapacity ?? 0, space?.standingCapacity ?? 0);
  const selectionKey = JSON.stringify({ spaceId: form.spaceId, eventType: form.eventType, slotType: form.slotType, date: form.date, startTime: form.startTime, endTime: form.endTime, endsNextDay: form.endsNextDay });
  const [checkedKey, setCheckedKey] = React.useState("");
  React.useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      previewPhoneBookingAction(slug, JSON.parse(selectionKey)).then((result) => {
        if (active) { setLive(result); setCheckedKey(selectionKey); }
      }).catch(() => {
        if (active) { setLive({ ok: false, error: "Could not check availability. Try again." }); setCheckedKey(selectionKey); }
      });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [slug, selectionKey]);
  const currentLive = checkedKey === selectionKey ? live : null;

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in fieldErrors) setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  };

  async function submit(action: SubmitAction) {
    const fe: typeof fieldErrors = {};
    if (!form.clientName.trim()) fe.clientName = "Enter the caller's name";
    if (form.clientPhone.trim().length < 5) fe.clientPhone = "Enter a phone number";
    if (!form.spaceId) fe.spaceId = "Pick a space";
    if (!form.endsNextDay && form.endTime <= form.startTime) fe.endTime = "End time must be after start. For overnight events, select Ends next day.";
    if (!Number.isInteger(Number(form.guestCount)) || Number(form.guestCount) < 0) fe.guestCount = "Enter a valid guest count.";
    if (form.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail)) fe.clientEmail = "Enter a valid email address.";
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) {
      setError(null);
      const firstKey = Object.keys(fe)[0];
      const id = ({ clientName: "nb-name", clientPhone: "nb-phone", spaceId: "nb-space", endTime: "nb-end", guestCount: "nb-guests", clientEmail: "nb-email" } as Record<string, string>)[firstKey];
      document.getElementById(id)?.focus();
      return;
    }

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
      setFinancial({ totalCents: res.totalCents, depositCents: res.depositCents, currency: res.currency });
      router.refresh();
      if (action === "CONFIRM" && res.depositUrl) {
        setConfirmed({ bookingId: res.bookingId, depositUrl: res.depositUrl });
        onConfirmed();
        toast("Booking confirmed — deposit link ready");
        return;
      }
      if (action === "CONFIRM") {
        // No deposit link came back — fall back to a toast.
        toast(`Booking confirmed for ${form.clientName.trim()}`);
        onClose();
        return;
      }
      const days = Math.min(30, Math.max(1, Number(form.pencilDays) || 5));
      const email = form.clientEmail.trim();
      setLogged({
        action,
        bookingId: res.bookingId,
        email,
        holdUntil: res.holdUntil ? new Date(res.holdUntil).getTime() : null,
      });
      toast(
        action === "INQUIRY"
          ? "Inquiry logged"
          : action === "QUOTE"
            ? email
              ? `Quote sent to ${email}`
              : "Quote created"
            : `Penciled for ${days} ${days === 1 ? "day" : "days"}`
      );
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setPending(null);
    }
  }

  // Success view after CONFIRM: summary + the private deposit link.
  if (confirmed) {
    return (
      <ConfirmedView
        slug={slug}
        timezone={timezone}
        form={form}
        space={spaces.find((sp) => sp.id === form.spaceId)}
        bookingId={confirmed.bookingId}
        depositUrl={confirmed.depositUrl}
        financial={financial}
        onClose={onClose}
      />
    );
  }

  if (logged) {
    return (
      <LoggedView
        slug={slug}
        timezone={timezone}
        form={form}
        space={spaces.find((sp) => sp.id === form.spaceId)}
        financial={financial}
        {...logged}
        onClose={onClose}
      />
    );
  }

  const busy = pending !== null;
  const noEmail = form.clientEmail.trim() === "";

  return (
    <div>
      <div className="-mx-5 mb-6 border-b border-border px-5 pb-5 sm:-mx-7 sm:px-7">
        <div className="flex items-center gap-2"><DialogTitle className="mb-0">New booking</DialogTitle><Badge variant="accent">Fast phone booking</Badge></div>
        <DialogDescription className="mb-0 mt-2 text-xs">{timezone} · {shortDate(form.date)}</DialogDescription>
        <ol className="mt-5 flex items-center gap-3 text-xs text-muted-foreground">{["Details", "Availability", "Outcome"].map((label, index) => <li key={label} className="flex flex-1 items-center gap-2"><span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", index === 0 ? "bg-primary text-primary-foreground" : "bg-muted")}>{index + 1}</span>{label}</li>)}</ol>
      </div>
      {Object.values(fieldErrors).some(Boolean) && <Callout tone="danger" title="Review the booking details" className="mb-5"><ul className="list-disc pl-4">{Object.values(fieldErrors).filter(Boolean).map((message) => <li key={message}>{message}</li>)}</ul></Callout>}

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nb-name">Client name</Label>
            <Input
              id="nb-name"
              value={form.clientName}
              onChange={(e) => set("clientName", e.target.value)}
              placeholder="Ada Okafor"
              autoComplete="off"
              aria-invalid={fieldErrors.clientName ? true : undefined}
              aria-describedby={fieldErrors.clientName ? "nb-name-err" : undefined}
              autoFocus
            />
            {fieldErrors.clientName && (
              <FieldHint id="nb-name-err" error>
                {fieldErrors.clientName}
              </FieldHint>
            )}
          </div>
          <div>
            <Label htmlFor="nb-phone">Phone</Label>
            <Input
              id="nb-phone"
              type="tel"
              value={form.clientPhone}
              onChange={(e) => set("clientPhone", e.target.value)}
              placeholder="+1 555 010 2030"
              aria-invalid={fieldErrors.clientPhone ? true : undefined}
              aria-describedby={fieldErrors.clientPhone ? "nb-phone-err" : undefined}
            />
            {fieldErrors.clientPhone && (
              <FieldHint id="nb-phone-err" error>
                {fieldErrors.clientPhone}
              </FieldHint>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="nb-email">
            Email <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="nb-email"
            type="email"
            value={form.clientEmail}
            onChange={(e) => set("clientEmail", e.target.value)}
            placeholder="ada@example.com"
            aria-invalid={Boolean(fieldErrors.clientEmail)}
            aria-describedby={fieldErrors.clientEmail ? "nb-email-err" : undefined}
          />
          {fieldErrors.clientEmail && <FieldHint id="nb-email-err" error>{fieldErrors.clientEmail}</FieldHint>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nb-space">Space</Label>
            <Select
              id="nb-space"
              value={form.spaceId}
              onChange={(e) => set("spaceId", e.target.value)}
              aria-invalid={fieldErrors.spaceId ? true : undefined}
              aria-describedby={fieldErrors.spaceId ? "nb-space-err" : undefined}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {fieldErrors.spaceId && (
              <FieldHint id="nb-space-err" error>
                {fieldErrors.spaceId}
              </FieldHint>
            )}
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
              aria-invalid={Boolean(fieldErrors.endTime)}
              aria-describedby={fieldErrors.endTime ? "nb-end-err" : undefined}
            />
            {fieldErrors.endTime && <FieldHint id="nb-end-err" error>{fieldErrors.endTime}</FieldHint>}
          </div>
          <label className="col-span-2 flex min-h-10 items-center gap-2 text-sm text-foreground sm:col-span-1 sm:mt-7">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              checked={form.endsNextDay}
              onChange={(e) => set("endsNextDay", e.target.checked)}
            />
            Ends next day
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nb-guests">Guest count</Label>
            <NumberStepper id="nb-guests" label="Guest count" value={form.guestCount} min={0} max={100000} onChange={(value) => set("guestCount", value)} invalid={Boolean(fieldErrors.guestCount)} />
            {fieldErrors.guestCount && <FieldHint error>{fieldErrors.guestCount}</FieldHint>}
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

        {error && !alternatives && <Callout tone="danger" title="Could not save booking">{error}</Callout>}
        <Dialog open={alternatives !== null} onClose={() => setAlternatives(null)} className="max-w-2xl" ariaLabel="Booking conflict">
          <span className="text-xs font-medium text-primary">Booking conflict</span>
          <DialogTitle className="mt-2 text-xl">That window is already booked</DialogTitle>
          <DialogDescription>Choose another space or date, or save this request as an inquiry for follow-up.</DialogDescription>
          <div className="rounded-lg bg-accent/50 p-3 text-xs">Showing availability in {timezone}</div>
          <section className="my-4 rounded-xl border border-border bg-background p-4"><h3 className="text-sm font-semibold">Requested window</h3><p className="mt-2 text-sm">{space?.name} · {shortDate(form.date)}</p><p className="mt-1 text-xs text-muted-foreground">{form.startTime}–{form.endTime}{form.endsNextDay ? " (ends next day)" : ""} · includes setup and teardown buffers</p></section>
          <h3 className="mb-3 text-sm font-semibold">Available alternatives</h3>
          <div className="space-y-2">
            {alternatives?.spaces.map((alternative, index) => <div key={alternative.id} className="flex items-center gap-3 rounded-xl border border-border p-4"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{index + 1}</span><div className="flex-1"><p className="text-sm font-medium">{alternative.name}</p><p className="mt-1 text-xs text-muted-foreground">Same date and time · check the updated price before saving</p></div><Button size="sm" onClick={() => { set("spaceId", alternative.id); setAlternatives(null); setError(null); }}>Select</Button></div>)}
            {alternatives?.dates.map((iso, index) => <div key={iso} className="flex items-center gap-3 rounded-xl border border-border p-4"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{(alternatives?.spaces.length ?? 0) + index + 1}</span><div className="flex-1"><p className="text-sm font-medium">{space?.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatInVenueTz(new Date(iso), timezone, "EEEE, MMM d")} · same time</p></div><Button size="sm" onClick={() => { set("date", venueDateStr(new Date(iso), timezone)); setAlternatives(null); setError(null); }}>Select</Button></div>)}
            {alternatives && !alternatives.spaces.length && !alternatives.dates.length && <p className="text-sm text-muted-foreground">No nearby alternatives were found. Edit the request to try another time.</p>}
          </div>
          <div className="mt-5 space-y-2 border-t border-border pt-4"><Button className="w-full" disabled={busy} onClick={() => submit("INQUIRY")}>{busy ? "Saving…" : "Save as inquiry"}</Button><Button variant="outline" className="w-full" onClick={() => setAlternatives(null)}>Edit request</Button></div>
        </Dialog>

        <section className="rounded-xl border border-border bg-accent/40 p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Live context</h3><span className={cn("text-xs font-medium", currentLive?.ok && currentLive.available ? "text-success" : "text-muted-foreground")}>{!currentLive ? "Checking…" : currentLive.ok ? currentLive.available ? "Available" : "Already booked" : "Check details"}</span></div>
          {currentLive && !currentLive.ok && <p className="mt-2 text-sm text-destructive">{currentLive.error}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Capacity</dt><dd>{capacity ? `${capacity} guests` : "Not specified"}</dd></div><div><dt className="text-xs text-muted-foreground">Buffers</dt><dd>{space?.setupBufferMins ?? 0} min setup · {space?.teardownBufferMins ?? 0} min teardown</dd></div>{currentLive?.ok && <><div><dt className="text-xs text-muted-foreground">Estimated total</dt><dd className="font-semibold">{formatMoney(currentLive.totalCents, currentLive.currency)}</dd></div><div><dt className="text-xs text-muted-foreground">Deposit</dt><dd className="font-semibold">{formatMoney(currentLive.depositCents, currentLive.currency)}</dd></div></>}</dl>
          {capacity > 0 && Number(form.guestCount) > capacity && <p className="mt-3 text-sm text-destructive">Guest count exceeds this space’s listed capacity. Check with your team before proceeding.</p>}
        </section>
        <fieldset className="space-y-2 border-t border-border pt-4">
          <legend className="mb-3 pt-4 text-sm font-semibold">Choose what happens next</legend>
          {([
            ["INQUIRY", "Log inquiry", "Save the lead for follow-up without holding the date."],
            ["QUOTE", noEmail ? "Create quote" : "Send quote", noEmail ? "Add an email above to send the quote." : "Create and email a quote for review."],
            ["PENCIL", "Pencil hold", "Block this window temporarily while the client decides."],
            ["CONFIRM", "Confirm + deposit link", "Block the space and prepare a private deposit link."],
          ] as const).map(([action, title, description]) => <label key={action} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors", chosen === action ? "border-primary bg-accent/40" : "border-border hover:bg-muted/40")}><input type="radio" name="booking-outcome" value={action} checked={chosen === action} onChange={() => setChosen(action)} className="mt-1 accent-primary" disabled={busy} /><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span></label>)}
          {chosen === "PENCIL" && <div><Label htmlFor="nb-pencil-days">Hold for (days)</Label><NumberStepper id="nb-pencil-days" label="Pencil days" min={1} max={30} value={form.pencilDays} onChange={(value) => set("pencilDays", value)} /></div>}
        </fieldset>
        <div className="sticky -bottom-7 -mx-5 flex items-center gap-3 border-t border-border bg-card px-5 py-4 sm:-mx-7 sm:px-7">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="flex-1" disabled={busy} onClick={() => submit(chosen)}>{busy ? "Saving…" : chosen === "INQUIRY" ? "Log inquiry" : chosen === "QUOTE" ? noEmail ? "Create quote" : "Send quote" : chosen === "PENCIL" ? "Save pencil hold" : "Confirm booking"}<ArrowRight className="h-4 w-4" aria-hidden /></Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmedView({
  slug,
  timezone,
  form,
  space,
  bookingId,
  depositUrl,
  financial,
  onClose,
}: {
  slug: string;
  timezone: string;
  form: SummaryForm;
  space: CalSpace | undefined;
  bookingId: string;
  depositUrl: string;
  financial: { totalCents: number; depositCents: number; currency: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const name = form.clientName.trim();
  const guests = Math.max(0, Number(form.guestCount) || 0);
  const r = targetRange(timezone, form, space);
  const fmt = (ms: number, f: string) => formatInVenueTz(new Date(ms), timezone, f);
  const crosses = venueDateStr(new Date(r.start), timezone) !== venueDateStr(new Date(r.end), timezone);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(depositUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the link is selectable */
    }
  }

  return (
    <div>
      <SuccessHeader
        title="Booking confirmed"
        description="The booking is confirmed and blocking the space. Share the deposit link to collect payment."
        badge={
          <Badge variant="success">
            <Check aria-hidden />
            Confirmed · blocking
          </Badge>
        }
      />

      <div className="mt-5 grid gap-4 md:grid-cols-[3fr_2fr]">
        <section
          aria-labelledby="nb-ok-summary"
          className="rounded-xl border border-border bg-background p-4 sm:p-5"
        >
          <h3 id="nb-ok-summary" className="font-semibold text-foreground">
            Booking summary
          </h3>
          <p className="mb-4 text-[13px] text-muted-foreground">Everything the team needs at a glance.</p>
          <dl className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
            <Fact icon={<User aria-hidden />} label="Client">
              {name}
            </Fact>
            <Fact icon={<Sparkles aria-hidden />} label="Event">
              {EVENT_TYPE_LABELS[form.eventType as keyof typeof EVENT_TYPE_LABELS] ?? form.eventType}
            </Fact>
            <Fact icon={<MapPin aria-hidden />} label="Space">
              {space?.name ?? "—"}
            </Fact>
            <Fact icon={<Users aria-hidden />} label="Guests">
              {guests} {guests === 1 ? "guest" : "guests"}
            </Fact>
            <Fact icon={<Calendar aria-hidden />} label="Date and time" className="sm:col-span-2">
              {fmt(r.start, "EEE MMM d, h:mm a")} – {fmt(r.end, crosses ? "EEE h:mm a" : "h:mm a")}
            </Fact>
          </dl>
          {r.blockedStart !== null && r.blockedEnd !== null && (
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <dt className="text-xs text-muted-foreground">Setup starts</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">
                  {r.blockedStart < r.start ? fmt(r.blockedStart, "h:mm a") : "No setup buffer"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Teardown ends</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">
                  {r.blockedEnd > r.end ? fmt(r.blockedEnd, "h:mm a") : "No teardown buffer"}
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section
          aria-labelledby="nb-ok-payment"
          className="rounded-xl border border-border bg-background p-4 sm:p-5"
        >
          <h3 id="nb-ok-payment" className="font-semibold text-foreground">
            Payment summary
          </h3>
          <p className="text-[13px] text-muted-foreground">Deposit and remaining balance</p>
          {financial && <dl className="mt-6 divide-y divide-border">{[["Total", financial.totalCents], ["Deposit due", financial.depositCents], ["Remaining balance", financial.totalCents - financial.depositCents]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-lg font-semibold">{formatMoney(Number(value), financial.currency)}</dd></div>)}</dl>}
        </section>
      </div>

      <section
        aria-labelledby="nb-ok-link"
        className="mt-4 rounded-xl border border-border bg-accent/50 p-4 sm:p-5"
      >
        <h3 id="nb-ok-link" className="font-semibold text-foreground">
          Private deposit link
        </h3>
        <p className="mb-3 text-[13px] text-muted-foreground">
          Share this link with {name} to collect the deposit.
        </p>
        <Label htmlFor="nb-deposit-url" className="sr-only">
          Deposit link
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="nb-deposit-url"
            readOnly
            value={depositUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 bg-card font-mono text-xs"
          />
          <Button
            size="icon"
            variant={copied ? "success" : "default"}
            onClick={copyLink}
            aria-label={copied ? "Link copied" : "Copy deposit link"}
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
        <p className="mt-1.5 text-[13px] text-muted-foreground" aria-live="polite">
          {copied ? "Link copied — paste it into a text or WhatsApp." : "Text, WhatsApp or email it to the client."}
        </p>
      </section>

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">The booking is now on the calendar.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Link
            href={`/app/${slug}/bookings/${bookingId}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open booking
          </Link>
          <Button onClick={onClose}>
            Done
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

type SummaryForm = {
  clientName: string;
  eventType: string;
  date: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  guestCount: string;
};

/** Shared success header: check icon, title, one-line description, status badge. */
function SuccessHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description: React.ReactNode;
  badge: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="mb-0">{description}</DialogDescription>
        </div>
      </div>
      <div className="mt-4">{badge}</div>
    </>
  );
}

/** Success view for INQUIRY, QUOTE and PENCIL outcomes. */
function LoggedView({
  slug,
  timezone,
  form,
  space,
  action,
  bookingId,
  email,
  holdUntil,
  financial,
  onClose,
}: {
  slug: string;
  timezone: string;
  form: SummaryForm;
  space: CalSpace | undefined;
  action: Exclude<SubmitAction, "CONFIRM">;
  bookingId: string;
  email: string;
  holdUntil: number | null;
  financial: { totalCents: number; depositCents: number; currency: string } | null;
  onClose: () => void;
}) {
  const guests = Math.max(0, Number(form.guestCount) || 0);
  const r = targetRange(timezone, form, space);
  const fmt = (ms: number, f: string) => formatInVenueTz(new Date(ms), timezone, f);
  const crosses = venueDateStr(new Date(r.start), timezone) !== venueDateStr(new Date(r.end), timezone);
  const holdDate = holdUntil !== null ? fmt(holdUntil, "EEE MMM d, h:mm a") : "";

  const copy =
    action === "INQUIRY"
      ? {
          title: "Inquiry logged",
          description: "The inquiry was saved for follow-up.",
          badge: (
            <Badge variant="accent">
              <MessageSquare aria-hidden />
              Inquiry · needs follow-up
            </Badge>
          ),
          callout: <Callout tone="neutral">The space is not held or blocked.</Callout>,
          view: "View inquiry",
        }
      : action === "QUOTE"
        ? {
            title: "Quote sent",
            description: email
              ? `The quote was emailed to ${email}.`
              : "The quote was created for this client.",
            badge: (
              <Badge variant="accent">
                <FileText aria-hidden />
                Quote created — space not blocked
              </Badge>
            ),
            callout: email ? (
              <Callout tone="neutral">The space is not held or blocked.</Callout>
            ) : (
              <Callout tone="warning" title="No email on file">
                The quote wasn&apos;t emailed. Share it from the booking page.
              </Callout>
            ),
            view: "View quote",
          }
        : {
            title: `Space penciled until ${holdDate}`,
            description: "The space is held for this client while they decide.",
            badge: (
              <Badge variant="warning">
                <Clock aria-hidden />
                Penciled · blocking until {holdDate}
              </Badge>
            ),
            callout: (
              <Callout tone="warning">
                The space is blocked for other bookings until {holdDate}. The hold expires automatically
                unless you confirm it.
              </Callout>
            ),
            view: "View booking",
          };

  const rows: [string, React.ReactNode][] = [
    ["Client", form.clientName.trim()],
    ["Event", EVENT_TYPE_LABELS[form.eventType as keyof typeof EVENT_TYPE_LABELS] ?? form.eventType],
    ["Space", space?.name ?? "—"],
    ["Date", fmt(r.start, "EEE MMM d")],
    ["Time", `${fmt(r.start, "h:mm a")} – ${fmt(r.end, crosses ? "EEE h:mm a" : "h:mm a")}`],
    ["Guests", `${guests} ${guests === 1 ? "guest" : "guests"}`],
  ];

  return (
    <div>
      <SuccessHeader title={copy.title} description={copy.description} badge={copy.badge} />

      <dl className="mt-5 space-y-3 rounded-xl border border-border bg-background p-4 sm:p-5">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      {action === "QUOTE" && financial && <dl className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-border bg-accent/30 p-4"><div><dt className="text-xs text-muted-foreground">Quote total</dt><dd className="mt-1 font-semibold">{formatMoney(financial.totalCents, financial.currency)}</dd></div><div><dt className="text-xs text-muted-foreground">Deposit requested</dt><dd className="mt-1 font-semibold">{formatMoney(financial.depositCents, financial.currency)}</dd></div></dl>}
      <div className="mt-4">{copy.callout}</div>

      <section aria-labelledby="nb-next" className="mt-5">
        <h3 id="nb-next" className="mb-2 text-sm font-semibold text-foreground">
          Next actions
        </h3>
        <div className="space-y-2">
          <Link
            href={`/app/${slug}/bookings/${bookingId}`}
            className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between")}
          >
            {copy.view}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </section>
    </div>
  );
}

function Fact({
  icon,
  label,
  className,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex gap-2.5 ${className ?? ""}`}>
      <span className="mt-0.5 text-primary [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium text-foreground">{children}</dd>
      </div>
    </div>
  );
}

function NumberStepper({ id, label, value, min, max, onChange, invalid }: { id: string; label: string; value: string; min: number; max: number; onChange: (value: string) => void; invalid?: boolean }) {
  const adjust = (delta: number) => onChange(String(Math.min(max, Math.max(min, (Number(value) || 0) + delta))));
  return <div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label={`Decrease ${label.toLowerCase()}`} disabled={Number(value) <= min} onClick={() => adjust(-1)}>−</Button><Input id={id} type="number" min={min} max={max} inputMode="numeric" value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={invalid} className="min-w-0 flex-1 text-center" /><Button type="button" variant="outline" size="icon" aria-label={`Increase ${label.toLowerCase()}`} disabled={Number(value) >= max} onClick={() => adjust(1)}>+</Button></div>;
}
