"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { createVenueAction } from "@/actions/venue";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent } from "@/components/ui/card";
import { FieldHint, Input, Label, Select } from "@/components/ui/input";
import { TIMEZONES, timezoneOptions } from "../venue-options";

export function NewVenueForm() {
  const [error, setError] = React.useState<string | null>(null);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [timezone, setTimezone] = React.useState("America/New_York");
  const [pending, startTransition] = React.useTransition();

  // Default to the browser's timezone after mount (avoids hydration mismatch).
  React.useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (TIMEZONES.some((t) => t.value === tz)) setTimezone(tz);
    } catch {
      /* keep default */
    }
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    setError(null);
    if (name.length < 2) {
      setNameError(name ? "Use at least 2 characters." : "Enter your venue's name.");
      document.getElementById("venue-name")?.focus();
      return;
    }
    setNameError(null);
    startTransition(async () => {
      // Redirects to /app/[slug]/onboarding on success.
      const res = await createVenueAction(formData);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div>
            <Label htmlFor="venue-name">
              Venue name <span className="ml-1 text-xs font-medium text-destructive">required</span>
            </Label>
            <Input
              id="venue-name"
              name="name"
              required
              aria-required
              minLength={2}
              maxLength={120}
              placeholder="e.g. The Garden Hall"
              autoFocus
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "venue-name-err" : undefined}
              onChange={() => nameError && setNameError(null)}
            />
            {nameError && (
              <FieldHint id="venue-name-err" error>
                {nameError}
              </FieldHint>
            )}
          </div>
          <div>
            <Label htmlFor="venue-tz">Timezone</Label>
            <Select
              id="venue-tz"
              name="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              aria-describedby="venue-tz-hint"
            >
              {timezoneOptions().map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </Select>
            <FieldHint id="venue-tz-hint">All bookings and availability are shown in this timezone.</FieldHint>
          </div>
          <p className="border-t border-border pt-4 text-[13px] text-muted-foreground">
            You can add your address, description, policies, spaces and branding after this.
          </p>
        </CardContent>
      </Card>

      <Callout tone="info">
        Your venue gets a private workspace first. You choose when to publish its public page.
      </Callout>
      <p className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        New venues start on a 30-day free trial.
      </p>

      {error && <Callout tone="danger">{error}</Callout>}

      {/* Sticky full-width bar on mobile; a normal button from sm up. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 p-4 backdrop-blur sm:static sm:z-auto sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
          {pending ? "Creating…" : "Create venue"}
        </Button>
      </div>
    </form>
  );
}
