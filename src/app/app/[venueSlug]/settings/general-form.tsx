"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { updateVenueDetailsAction } from "@/actions/venue";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export interface VenueGeneralInitial {
  name: string;
  timezone: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  description: string;
}

export function GeneralForm({
  slug,
  initial,
}: {
  slug: string;
  initial: VenueGeneralInitial;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const timezones = TIMEZONES.includes(initial.timezone)
    ? TIMEZONES
    : [initial.timezone, ...TIMEZONES];

  return (
    <form
      className="space-y-3"
      action={async (formData: FormData) => {
        setSaving(true);
        setMessage(null);
        const res = await updateVenueDetailsAction(slug, formData);
        setSaving(false);
        if (res?.ok === false) {
          setMessage({ ok: false, text: res.error });
        } else {
          setMessage({ ok: true, text: "Venue details saved." });
          router.refresh();
        }
      }}
    >
      {message && (
        <p
          className={
            message.ok
              ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
          }
        >
          {message.text}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="v-name">Venue name</Label>
          <Input id="v-name" name="name" defaultValue={initial.name} required />
        </div>
        <div>
          <Label htmlFor="v-tz">Timezone</Label>
          <Select id="v-tz" name="timezone" defaultValue={initial.timezone}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-zinc-500">All booking times use this timezone.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="v-email">Contact email</Label>
          <Input id="v-email" name="email" type="email" defaultValue={initial.email} placeholder="bookings@yourvenue.com" />
        </div>
        <div>
          <Label htmlFor="v-phone">Phone</Label>
          <Input id="v-phone" name="phone" defaultValue={initial.phone} placeholder="+1 555 000 0000" />
        </div>
      </div>
      <div>
        <Label htmlFor="v-addr">Street address</Label>
        <Input id="v-addr" name="addressLine1" defaultValue={initial.addressLine1} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="v-city">City</Label>
          <Input id="v-city" name="city" defaultValue={initial.city} />
        </div>
        <div>
          <Label htmlFor="v-region">State / Region</Label>
          <Input id="v-region" name="region" defaultValue={initial.region} />
        </div>
        <div>
          <Label htmlFor="v-postal">Postal code</Label>
          <Input id="v-postal" name="postalCode" defaultValue={initial.postalCode} />
        </div>
      </div>
      <div>
        <Label htmlFor="v-country">Country (2-letter code)</Label>
        <Input id="v-country" name="country" defaultValue={initial.country} maxLength={2} className="max-w-24 uppercase" />
      </div>
      <div>
        <Label htmlFor="v-desc">Description (shown on your public page)</Label>
        <Textarea
          id="v-desc"
          name="description"
          defaultValue={initial.description}
          placeholder="Tell clients what makes your venue special…"
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}
