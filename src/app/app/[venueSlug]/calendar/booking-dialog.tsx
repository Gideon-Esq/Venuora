"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, CalendarDays, CheckCircle2, Copy, ExternalLink, Globe2, LockKeyhole, Mail, MessageCircle, Move, Phone, Send, TriangleAlert } from "lucide-react";
import { applyRescheduleAction, previewRescheduleAction, sendBalanceLinkAction, type ReschedulePreview } from "@/actions/booking";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { formatInVenueTz, venueDateStr } from "@/lib/time";
import { cn } from "@/lib/utils";
import { targetRange, timeRange, type CalBooking, type CalSpace, type MoveTarget } from "./cal-shared";
import { hatchStyle } from "./cal-ui";

type Props = { slug: string; timezone: string; currency: string; spaces: CalSpace[]; booking: CalBooking | null; movePrefill: MoveTarget | null; canManage: boolean; managerEmail: string | null; onClose: () => void };
export function BookingDialog(props: Props) {
  return <Dialog open={props.booking !== null} onClose={props.onClose} variant="drawer" className={props.canManage ? "max-w-[30rem]" : "max-w-[23rem]"} ariaLabel={props.canManage ? "Booking details" : "Read-only booking quick view"}>
    {props.booking && <Details key={`${props.booking.id}:${JSON.stringify(props.movePrefill)}`} {...props} booking={props.booking} />}
  </Dialog>;
}

function Details({ booking, ...props }: Omit<Props, "booking"> & { booking: CalBooking }) {
  const { slug, timezone, currency, spaces, canManage, managerEmail, onClose } = props;
  const [moving, setMoving] = React.useState(Boolean(props.movePrefill && canManage));
  const [paymentUrl, setPaymentUrl] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const toast = useToast();
  const space = spaces.find((item) => item.id === booking.spaceId);
  const fmt = (instant: number, pattern: string) => formatInVenueTz(new Date(instant), timezone, pattern);
  const buffer = (from: number, to: number) => from === to ? "None" : timeRange(from, to, timezone);
  const paymentSummary = (booking.paidCents ?? 0) >= booking.totalCents ? "Paid in full" : (booking.paidCents ?? 0) >= booking.depositCents && booking.depositCents > 0 ? "Deposit received" : "Deposit pending";

  if (moving && canManage) return <MoveReview {...props} booking={booking} onBack={() => setMoving(false)} />;
  async function preparePayment() {
    setSending(true);
    try { const result = await sendBalanceLinkAction(slug, booking.id); setPaymentUrl(result.url); toast("Payment link ready"); }
    catch { toast("Could not prepare the payment link. Try again."); }
    finally { setSending(false); }
  }
  return <div className="flex h-full flex-col">
    <header className="border-b border-border px-6 py-6 pr-12">
      {!canManage ? <><p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-primary">Read-only access <LockKeyhole className="h-3 w-3" aria-hidden /></p><DialogTitle className="mb-0 text-base">Booking quick view</DialogTitle></> : <><p className="text-xs uppercase tracking-wide text-muted-foreground">Booking reference</p><DialogTitle className="mt-1 text-base">{booking.id}</DialogTitle></>}
    </header>
    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
      <section><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-semibold">{booking.clientName}</h3><StatusBadge status={booking.status} /></div><p className="mt-1 text-xs text-muted-foreground">{EVENT_TYPE_LABELS[booking.eventType]}</p></section>
      {!canManage ? <>
        <div className="grid grid-cols-2 gap-3"><SmallFact label="Space">{booking.spaceName}</SmallFact><SmallFact label="Guests">{booking.guestCount} guests</SmallFact></div>
        <section className="space-y-4 rounded-xl border border-border p-4 text-xs"><div className="flex gap-2.5"><CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden /><div><p className="font-medium">{fmt(booking.start, "EEE MMM d")}</p><p className="mt-1 text-muted-foreground">{timeRange(booking.start, booking.end, timezone)}</p></div></div><p className="flex items-center gap-2.5"><Globe2 className="h-4 w-4 text-primary" aria-hidden />{timezone}</p></section>
        <section><h3 className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">Schedule buffers</h3><div className="space-y-2"><BufferRow label="Setup" value={buffer(booking.blockedStart, booking.start)} /><BufferRow label="Teardown" value={buffer(booking.end, booking.blockedEnd)} /></div></section>
        <div className="grid grid-cols-2 gap-3"><SmallFact label="Capacity">{Math.max(space?.seatedCapacity ?? 0, space?.standingCapacity ?? 0) || "Not set"}</SmallFact><SmallFact label="Payment summary">{paymentSummary}</SmallFact></div>
        <section className="rounded-xl border border-border p-4"><h3 className="text-xs font-semibold">Operational notes</h3><p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{booking.notes || "No operational notes."}</p></section>
      </> : <>
        {(booking.clientPhone || booking.clientEmail) && <div className="space-y-3 border-b border-border pb-5 text-sm">{booking.clientPhone && <a href={`tel:${booking.clientPhone}`} className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" />{booking.clientPhone}</a>}{booking.clientEmail && <a href={`mailto:${booking.clientEmail}`} className="flex items-center gap-3 break-all"><Mail className="h-4 w-4 shrink-0 text-muted-foreground" />{booking.clientEmail}</a>}</div>}
        <Section title="Event details"><Row label="Space">{booking.spaceName}</Row><Row label="Date">{fmt(booking.start, "EEE MMM d yyyy")}</Row><Row label="Time">{timeRange(booking.start, booking.end, timezone)}</Row><Row label="Timezone">{timezone}</Row><Row label="Guests">{booking.guestCount} guests</Row></Section>
        <Section title="Operations"><Row label="Setup">{buffer(booking.blockedStart, booking.start)}</Row><Row label="Event">{timeRange(booking.start, booking.end, timezone)}</Row><Row label="Teardown">{buffer(booking.end, booking.blockedEnd)}</Row>{booking.holdExpiresAt && <Row label="Held until">{fmt(booking.holdExpiresAt, "EEE MMM d, h:mm a")}</Row>}</Section>
        <Section title="Money"><Row label="Total">{formatMoney(booking.totalCents, currency)}</Row><Row label="Deposit">{formatMoney(booking.depositCents, currency)}</Row><Row label="Paid">{formatMoney(booking.paidCents ?? 0, currency)}</Row><Row label="Outstanding">{formatMoney(Math.max(0, booking.totalCents - (booking.paidCents ?? 0)), currency)}</Row></Section>
        {booking.notes && <Section title="Operational notes"><p className="whitespace-pre-wrap text-sm">{booking.notes}</p></Section>}
        {paymentUrl && <section className="rounded-xl border border-border bg-accent/30 p-4"><h3 className="text-sm font-semibold">Payment link ready</h3><Input aria-label="Payment link" value={paymentUrl} readOnly className="mt-3 text-xs" onFocus={(event) => event.target.select()} /><CopyLink url={paymentUrl} /></section>}
      </>}
    </div>
    <footer className={cn("border-t border-border bg-card px-6 py-4", canManage ? "space-y-2" : "flex items-center justify-between gap-3")}>
      {canManage ? <><Button className="w-full" onClick={() => setMoving(true)}><Move className="h-4 w-4" />Move booking</Button><Button variant="outline" className="w-full" disabled={sending} onClick={preparePayment}><Send className="h-4 w-4" />{sending ? "Preparing…" : "Send payment link"}</Button><Link href={`/app/${slug}/bookings/${booking.id}`} className={buttonVariants({ variant: "outline", className: "w-full" })}><ExternalLink className="h-4 w-4" />Open full booking</Link><Button variant="ghost" className="w-full" onClick={onClose}>Close</Button></> : <><Button variant="outline" size="sm" onClick={onClose}>Close</Button>{managerEmail ? <a href={`mailto:${managerEmail}?subject=${encodeURIComponent(`Booking question: ${booking.clientName}`)}`} className={buttonVariants({ size: "sm" })}><MessageCircle className="h-3.5 w-3.5" />Contact manager</a> : <Button size="sm" disabled title="No manager contact is available"><MessageCircle className="h-3.5 w-3.5" />Contact manager</Button>}</>}
    </footer>
  </div>;
}

function MoveReview({ booking, onBack, ...props }: Omit<Props, "booking"> & { booking: CalBooking; onBack: () => void }) {
  const { slug, timezone, currency, spaces, onClose } = props;
  const router = useRouter();
  const toast = useToast();
  const initial = props.movePrefill ?? { spaceId: booking.spaceId, date: venueDateStr(new Date(booking.start), timezone), startTime: formatInVenueTz(new Date(booking.start), timezone, "HH:mm"), endTime: formatInVenueTz(new Date(booking.end), timezone, "HH:mm"), endsNextDay: venueDateStr(new Date(booking.end), timezone) !== venueDateStr(new Date(booking.start), timezone) };
  const [target, setTarget] = React.useState<MoveTarget>(initial);
  const [preview, setPreview] = React.useState<ReschedulePreview | null>(null);
  const [pending, setPending] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [moved, setMoved] = React.useState<number | null>(null);
  const [raceConflict, setRaceConflict] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = JSON.stringify(target);
  const [checkedKey, setCheckedKey] = React.useState("");
  const [retry, setRetry] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setPending(true);
      try { const result = await previewRescheduleAction(slug, booking.id, JSON.parse(key)); if (active) { setPreview(result); setCheckedKey(key); } }
      catch { if (active) { setPreview({ ok: false, error: "Could not check this window. Try another selection." }); setCheckedKey(key); } }
      finally { if (active) setPending(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [slug, booking.id, key, retry]);
  const current = checkedKey === key ? preview : null;
  const space = spaces.find((item) => item.id === target.spaceId);
  const range = targetRange(timezone, target, space);
  const fmt = (instant: number, pattern = "h:mm a") => formatInVenueTz(new Date(instant), timezone, pattern);
  const update = (patch: Partial<MoveTarget>) => { setTarget((old) => ({ ...old, ...patch })); setAcknowledged(false); setError(null); };
  async function apply() {
    if (!current?.ok || !current.available || (current.priceChanged && !acknowledged)) return;
    setApplying(true); setError(null);
    try {
      const result = await applyRescheduleAction(slug, booking.id, target, current.newTotalCents);
      if (!result.ok) {
        const refreshed = await previewRescheduleAction(slug, booking.id, target);
        setPreview(refreshed); setCheckedKey(key); setAcknowledged(false);
        setRaceConflict(refreshed.ok && refreshed.available === false && Boolean(refreshed.conflict));
        setError(result.error); return;
      }
      setMoved(result.totalCents); router.refresh(); toast(`Booking moved to ${fmt(range.start, "EEE, MMM d")}`);
    } catch { setError("Could not move the booking. Please try again."); }
    finally { setApplying(false); }
  }
  if (moved !== null) return <div className="flex h-full flex-col"><div className="flex-1 overflow-y-auto px-7 py-9"><span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="h-7 w-7" /></span><DialogTitle className="text-2xl">Booking moved</DialogTitle><DialogDescription>Calendar updated</DialogDescription><section className="mt-7 rounded-xl border border-border bg-background p-6"><h3 className="text-lg font-semibold">{booking.clientName}</h3><p className="mt-1 break-all text-xs text-muted-foreground">{booking.id}</p><dl className="mt-7 grid grid-cols-2 gap-x-4 gap-y-6"><Fact label="Date">{fmt(range.start, "EEE MMM d yyyy")}</Fact><Fact label="Space">{space?.name}</Fact><Fact label="Event time">{timeRange(range.start, range.end, timezone)}</Fact><Fact label="Status"><StatusBadge status={booking.status} /></Fact><Fact label="Setup">{range.blockedStart === range.start ? "None" : timeRange(range.blockedStart!, range.start, timezone)}</Fact><Fact label="Teardown">{range.blockedEnd === range.end ? "None" : timeRange(range.end, range.blockedEnd!, timezone)}</Fact></dl><div className="mt-6 flex items-center justify-between border-t border-border pt-5"><span className="text-sm text-muted-foreground">Price</span><strong className="text-xl">{formatMoney(moved, currency)}</strong></div></section></div><footer className="space-y-2 border-t border-border px-7 py-5"><Link href={`/app/${slug}/bookings/${booking.id}`} className={buttonVariants({ className: "w-full" })}>View booking</Link>{booking.clientEmail && <a href={`mailto:${booking.clientEmail}?subject=${encodeURIComponent("Your booking has moved")}&body=${encodeURIComponent(`Your booking at ${space?.name} is now on ${fmt(range.start, "EEE MMM d yyyy")} at ${timeRange(range.start, range.end, timezone)} (${timezone}).`)}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>Notify client</a>}<Button variant="ghost" className="w-full" onClick={onClose}>Done</Button></footer></div>;

  const rows: [string, React.ReactNode, React.ReactNode][] = [
    ["Date", fmt(booking.start, "EEE MMM d"), fmt(range.start, "EEE MMM d")],
    ["Space", booking.spaceName, space?.name],
    ["Event time", timeRange(booking.start, booking.end, timezone), timeRange(range.start, range.end, timezone)],
    ["Setup", booking.blockedStart === booking.start ? "None" : timeRange(booking.blockedStart, booking.start, timezone), range.blockedStart === range.start ? "None" : timeRange(range.blockedStart!, range.start, timezone)],
    ["Teardown", booking.blockedEnd === booking.end ? "None" : timeRange(booking.end, booking.blockedEnd, timezone), range.blockedEnd === range.end ? "None" : timeRange(range.end, range.blockedEnd!, timezone)],
    ["Total", formatMoney(booking.totalCents, currency), current?.newTotalCents === undefined ? "—" : formatMoney(current.newTotalCents, currency)],
    ["Deposit", formatMoney(booking.depositCents, currency), current?.depositCents === undefined ? "—" : formatMoney(current.depositCents, currency)],
    ["Balance", formatMoney(booking.totalCents - booking.depositCents, currency), current?.newTotalCents === undefined ? "—" : formatMoney(current.newTotalCents - (current.depositCents ?? booking.depositCents), currency)],
  ];
  return <div className="flex h-full flex-col">
    <header className="border-b border-border px-6 py-6 pr-12"><p className="mb-2 flex items-center gap-2 text-xs text-primary"><ArrowLeftRight className="h-3.5 w-3.5" />Move booking</p><DialogTitle>{current?.priceChanged ? "Review price change" : booking.clientName}</DialogTitle><DialogDescription className="mb-0 text-xs">{current?.priceChanged ? "Confirm the updated booking details before moving this event." : "Review the new date before confirming this move."}</DialogDescription></header>
    <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
      <div className="grid grid-cols-2 gap-4"><div><Label htmlFor="move-date">New date</Label><Input id="move-date" type="date" value={target.date} onChange={(event) => update({ date: event.target.value })} /></div><div><Label htmlFor="move-space">Space</Label><Select id="move-space" value={target.spaceId} onChange={(event) => update({ spaceId: event.target.value })}>{spaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div><div><Label htmlFor="move-start">Start</Label><Input id="move-start" type="time" step={900} value={target.startTime} onChange={(event) => update({ startTime: event.target.value })} /></div><div><Label htmlFor="move-end">End</Label><Input id="move-end" type="time" step={900} value={target.endTime} onChange={(event) => update({ endTime: event.target.value })} /></div><label className="col-span-2 flex items-center gap-2 text-xs"><input type="checkbox" className="accent-primary" checked={target.endsNextDay} onChange={(event) => update({ endsNextDay: event.target.checked })} />Ends next day</label></div>
      <div aria-live="polite">{!current || pending ? <p className="text-sm text-muted-foreground">Checking availability and price…</p> : !current.ok ? <Callout tone="danger">{current.error}</Callout> : current.available ? <Callout tone={current.priceChanged ? "warning" : "success"} title={current.priceChanged ? "Price changes because the new selection uses a different rate" : "Available"}>{current.priceChanged ? "The destination is available, but the updated selection changes the booking total." : "This window is open with setup and teardown buffers included."}</Callout> : <section className="rounded-xl border border-border p-4" style={hatchStyle("#dc2626")}><h3 className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert className="h-4 w-4 text-destructive" />Schedule overlap</h3><p className="mt-2 text-xs text-muted-foreground">{current.error || "The requested time overlaps an existing booking or its setup and teardown window."}</p>{current.conflict && <div className="mt-3 rounded-lg border border-border bg-card p-3"><p className="text-sm font-medium">{current.conflict.name}</p><p className="mt-1 text-xs">{current.conflict.space} · {timeRange(new Date(current.conflict.start).getTime(), new Date(current.conflict.end).getTime(), timezone)}</p><p className="mt-1 text-xs text-muted-foreground">Setup starts {formatInVenueTz(new Date(current.conflict.blockedStart), timezone, "h:mm a")}</p></div>}</section>}</div>
      {current?.ok && !current.available && <section><h3 className="text-xs font-medium uppercase text-muted-foreground">Available alternatives</h3><p className="mt-1 text-xs text-muted-foreground">Select an option to preview the move.</p><div className="mt-3 space-y-2">{current.alternatives?.map((item) => <button type="button" key={`${item.spaceId}:${item.date}`} className="block w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary" onClick={() => update(item)}><span className="block text-sm font-semibold">{item.name}</span><span className="mt-1 block text-xs text-muted-foreground">{item.date} · {item.startTime}–{item.endTime}</span></button>)}{!current.alternatives?.length && <p className="text-sm text-muted-foreground">Try another date or time.</p>}</div></section>}
      {current?.ok && current.available && <><div className="overflow-hidden rounded-xl border border-border"><table className="w-full text-left text-xs"><thead className="bg-background text-[10px] uppercase text-muted-foreground"><tr><th className="px-3 py-3 font-medium">Details</th><th className="px-3 py-3 font-medium">Before</th><th className="px-3 py-3 font-medium text-primary">After</th></tr></thead><tbody>{rows.map(([label, before, after]) => <tr key={label} className="border-t border-border"><th className="px-3 py-3 font-normal text-muted-foreground">{label}</th><td className="px-3 py-3">{before}</td><td className={cn("px-3 py-3 font-medium", current.priceChanged && ["Total", "Balance"].includes(label) && "text-primary")}>{after}</td></tr>)}</tbody></table></div>{current.priceChanged ? <label className="flex items-start gap-2 rounded-lg border border-border bg-background p-3 text-xs"><input type="checkbox" className="mt-0.5 accent-primary" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />I understand the client total changes from {formatMoney(booking.totalCents, currency)} to {formatMoney(current.newTotalCents!, currency)}.</label> : <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm"><span>No price change</span><strong>{formatMoney(current.newTotalCents!, currency)}</strong></div>}<p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">{space?.name} is available on {fmt(range.start, "EEE MMM d")} from {fmt(range.blockedStart!)} through {fmt(range.blockedEnd!)}, including setup and teardown.</p></>}
      {error && !raceConflict && <Callout tone="danger">{error}</Callout>}
    </div>
    <footer className="flex justify-end gap-2 border-t border-border bg-card px-6 py-4"><Button variant="outline" disabled={applying} onClick={onBack}>Cancel</Button><Button disabled={applying || !current?.ok || !current.available || Boolean(current.priceChanged && !acknowledged)} onClick={apply}>{applying ? "Moving…" : "Confirm move"}</Button></footer>
    <Dialog open={raceConflict} onClose={() => setRaceConflict(false)} ariaLabel="Time no longer available"><DialogTitle>This time is no longer available.</DialogTitle><DialogDescription>The selected space and time were taken while you were reviewing the move.</DialogDescription><div className="rounded-lg border border-border bg-background p-4 text-sm"><p className="font-medium">Conflicting booking</p>{current?.conflict ? <><p className="mt-2">{current.conflict.space} · {current.conflict.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatInVenueTz(new Date(current.conflict.start), timezone, "MMM d yyyy")} · {timeRange(new Date(current.conflict.start).getTime(), new Date(current.conflict.end).getTime(), timezone)}</p></> : <p className="mt-2">{error}</p>}</div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setRaceConflict(false)}>Close</Button><Button onClick={() => { setRaceConflict(false); setPreview(null); setCheckedKey(""); setRetry((value) => value + 1); }}>Choose another time</Button></div></Dialog>
  </div>;
}
function CopyLink({ url }: { url: string }) { const [copied, setCopied] = React.useState(false); const toast = useToast(); return <Button className="mt-3 w-full" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { toast("Select the link to copy it."); } }}><Copy className="h-4 w-4" />{copied ? "Copied" : "Copy link"}</Button>; }
function SmallFact({ label, children }: { label: string; children: React.ReactNode }) { return <div className="rounded-lg border border-border bg-background p-3"><p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-xs font-medium">{children}</p></div>; }
function BufferRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-3 text-[11px]"><span>{label}</span><span>{value}</span></div>; }
function Fact({ label, children }: { label: string; children: React.ReactNode }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{children}</dd></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-border pb-5"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3><dl className="space-y-3">{children}</dl></section>; }
function Row({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex justify-between gap-4 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{children}</dd></div>; }
