"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DeactivateSpaceButton } from "../deactivate-button";
import { CurrencySelector } from "../currency-selector";
import { ExampleBooking, RatesFields, useRatePlanForm, type RatePlanFormInitial } from "../rate-plan-form";
import { SpaceAvailabilityFields, SpaceDetailsFields, useSpaceForm, type SpaceFormInitial } from "../space-form";

const TABS = [
  { value: "details", label: "Details" },
  { value: "rates", label: "Rates" },
  { value: "availability", label: "Availability" },
  { value: "danger", label: "Danger zone" },
] as const;
type Tab = (typeof TABS)[number]["value"];
type Group = "space" | "rates" | null;

const groupOf = (t: Tab): Group => (t === "details" || t === "availability" ? "space" : t === "rates" ? "rates" : null);
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.value === v);

export function SpaceEditor({
  slug,
  spaceId,
  spaceName,
  active,
  isOwner,
  spaceInitial,
  rateInitial,
  example,
}: {
  slug: string;
  spaceId: string;
  spaceName: string;
  active: boolean;
  isOwner: boolean;
  spaceInitial: SpaceFormInitial;
  rateInitial: RatePlanFormInitial | null;
  example: { start: string; end: string; timezone: string; currency: string; taxBps: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: Tab = isTab(rawTab) ? rawTab : "details";

  const spaceForm = useSpaceForm(slug, spaceId, spaceInitial);
  const rateForm = useRatePlanForm(slug, spaceId, rateInitial);
  const [pendingTab, setPendingTab] = React.useState<Tab | null>(null);

  const group = groupOf(tab);
  const activeForm = group === "space" ? spaceForm : group === "rates" ? rateForm : null;
  const dirty = !!activeForm?.dirty;
  const saving = !!activeForm?.saving || spaceForm.uploading;

  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const goTo = (t: Tab) => {
    setPendingTab(null);
    const params = new URLSearchParams(searchParams.toString());
    if (t === "details") params.delete("tab");
    else params.set("tab", t);
    const qs = params.toString();
    window.history.pushState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const requestTab = (t: Tab) => {
    if (spaceForm.uploading) {
      toast("Please wait for your images to finish uploading.");
      return;
    }
    if (t === tab) return;
    if (dirty && groupOf(t) !== group) {
      setPendingTab(t);
      return;
    }
    goTo(t);
  };

  const save = async () => {
    if (group === "space") {
      const res = await spaceForm.save();
      if (res === null) {
        toast("Please fix the highlighted fields.", "error");
        return false;
      }
      if (!res.ok) {
        toast(res.error, "error");
        return false;
      }
      toast("Space saved.");
      router.refresh();
      return true;
    }
    if (group === "rates") {
      const ok = await rateForm.save();
      if (ok) {
        toast("Rates saved.");
        router.refresh();
      } else {
        toast("Rates weren't saved — check the highlighted fields.", "error");
      }
      return ok;
    }
    return true;
  };

  const discard = () => {
    activeForm?.discard();
  };

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.value === tab);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next == null) return;
    e.preventDefault();
    const t = TABS[next].value;
    tabRefs.current[t]?.focus();
    requestTab(t);
  };

  const spaceDetailErrors = !!spaceForm.errors.name || !!spaceForm.errors.photos;
  const pendingLabel = pendingTab ? TABS.find((t) => t.value === pendingTab)?.label : null;

  return (
    <div className="space-y-6">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Space settings"
          onKeyDown={onTabKeyDown}
          className="flex min-w-max gap-1 border-b border-border"
        >
          {TABS.map((t) => {
            const selected = t.value === tab;
            return (
              <button
                key={t.value}
                ref={(el) => {
                  tabRefs.current[t.value] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${t.value}`}
                aria-selected={selected}
                aria-controls={`panel-${t.value}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => requestTab(t.value)}
                className={cn(
                  "-mb-px inline-flex h-11 items-center border-b-2 px-3 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  selected
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  t.value === "danger" && !selected && "hover:text-destructive"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={-1}>
        {tab === "details" && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Space details</CardTitle>
                <CardDescription>What clients see on your public page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {spaceForm.serverError && <Callout tone="danger">{spaceForm.serverError}</Callout>}
                <SpaceDetailsFields form={spaceForm} />
              </CardContent>
            </Card>
          </form>
        )}

        {tab === "availability" && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Availability</CardTitle>
                <CardDescription>
                  Buffers block time around every booking so you can set up and clean. They show as hatched
                  blocks on your calendar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {spaceForm.serverError && <Callout tone="danger">{spaceForm.serverError}</Callout>}
                {spaceDetailErrors && (
                  <Callout
                    tone="danger"
                    action={
                      <Button type="button" variant="outline" size="sm" onClick={() => goTo("details")}>
                        Go to Details
                      </Button>
                    }
                  >
                    Some fields on the Details tab need fixing before you can save.
                  </Callout>
                )}
                <SpaceAvailabilityFields form={spaceForm} />
              </CardContent>
            </Card>
          </form>
        )}

        {tab === "rates" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <form
              noValidate
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {isOwner && <CurrencySelector slug={slug} currency={example.currency} />}
              <Callout tone="info">Changes affect new bookings only. Existing booking prices do not change.</Callout>
              {!rateInitial && (
                <Callout tone="warning" title="No rates yet">
                  Set a base hourly rate so this space can be booked and quoted.
                </Callout>
              )}
              {rateForm.serverError && <Callout tone="danger">{rateForm.serverError}</Callout>}
              <RatesFields form={rateForm} currency={example.currency} />
            </form>
            <aside className="lg:sticky lg:top-6" aria-label="Example booking price">
              <ExampleBooking
                values={rateForm.values}
                spaceName={spaceName}
                exampleStart={example.start}
                exampleEnd={example.end}
                timezone={example.timezone}
                currency={example.currency}
                taxBps={example.taxBps}
                depositNote={
                  isOwner ? (
                    <>
                      The refundable security deposit is set in{" "}
                      <Link
                        href={`/app/${slug}/settings/policies`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Settings › Policies
                      </Link>
                      .
                    </>
                  ) : (
                    "The refundable security deposit is set by the venue owner in Settings › Policies."
                  )
                }
              />
            </aside>
          </div>
        )}

        {tab === "danger" && (
          <Card className={cn(active && "border-destructive/30")}>
            <CardHeader>
              <CardTitle>{active ? "Deactivate this space" : "This space is inactive"}</CardTitle>
              <CardDescription>
                {active
                  ? "Deactivating hides this space from clients. Existing bookings are untouched."
                  : "It's hidden from your public page and can't take new bookings. Contact support to reactivate it."}
              </CardDescription>
            </CardHeader>
            {active && (
              <CardContent>
                <DeactivateSpaceButton slug={slug} spaceId={spaceId} spaceName={spaceName} />
              </CardContent>
            )}
          </Card>
        )}
      </div>

      {dirty && (
        <div
          role="region"
          aria-label="Unsaved changes"
          className="sticky bottom-4 z-30 flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-foreground" aria-live="polite">
            <AlertCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {pendingTab
              ? `Leave with unsaved ${group === "rates" ? "rate " : ""}changes and go to ${pendingLabel}?`
              : `You have unsaved ${group === "rates" ? "rate " : ""}changes`}
          </p>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {pendingTab ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setPendingTab(null)}>
                  Stay here
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const t = pendingTab;
                    discard();
                    goTo(t);
                  }}
                >
                  Discard &amp; continue
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    const t = pendingTab;
                    if (await save()) goTo(t);
                    else setPendingTab(null);
                  }}
                >
                  {spaceForm.uploading ? "Uploading…" : saving ? "Saving…" : "Save & continue"}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={discard} disabled={saving} className="flex-1 sm:flex-none">
                  Discard
                </Button>
                <Button type="button" onClick={() => void save()} disabled={saving} className="flex-1 sm:flex-none">
                  {spaceForm.uploading ? "Uploading…" : saving ? "Saving…" : "Save changes"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
