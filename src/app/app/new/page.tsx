"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { createVenueAction } from "@/actions/venue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Manila",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export default function NewVenuePage() {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      // Redirects to /app/[slug]/onboarding on success.
      const res = await createVenueAction(formData);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-start">
          <span className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Building2 className="h-6 w-6" />
          </span>
          <CardTitle className="text-xl">Create your venue</CardTitle>
          <CardDescription>
            Give it a name and pick the timezone your calendar runs on. You can change
            everything later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label htmlFor="venue-name">Venue name</Label>
              <Input
                id="venue-name"
                name="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="e.g. The Garden Hall"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="venue-tz">Timezone</Label>
              <Select id="venue-tz" name="timezone" defaultValue="America/New_York">
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs text-zinc-500">
                All bookings and availability are shown in this timezone.
              </p>
            </div>
            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating…" : "Create venue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
