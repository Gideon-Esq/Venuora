"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateVenueDetailsAction } from "@/actions/venue";
import { countryOptions, timezoneOptions } from "../../venue-options";

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

type Field = keyof VenueGeneralInitial;
type Errors = Partial<Record<Field, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(v: VenueGeneralInitial): Errors {
  const errors: Errors = {};
  if (v.name.trim().length < 2) errors.name = "Enter a venue name (at least 2 characters).";
  if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) errors.email = "Enter a valid email address.";
  return errors;
}

export function GeneralForm({ slug, initial }: { slug: string; initial: VenueGeneralInitial }) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = React.useState<VenueGeneralInitial>(initial);
  const [values, setValues] = React.useState<VenueGeneralInitial>(initial);
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [justSaved, setJustSaved] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const dirty = (Object.keys(values) as Field[]).some((k) => values[k] !== saved[k]);
  const tzChanged = values.timezone !== saved.timezone;
  const timezones = React.useMemo(() => timezoneOptions(saved.timezone), [saved.timezone]);
  const countries = React.useMemo(() => countryOptions(saved.country), [saved.country]);

  function set<K extends Field>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const next = e.target.value;
      setValues((v) => ({ ...v, [key]: next }));
      setJustSaved(false);
      if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
    };
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length > 0) {
      const first = Object.keys(errs)[0];
      document.getElementById(`v-${first}`)?.focus();
      return;
    }
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateVenueDetailsAction(slug, formData);
      if (res?.ok === false) {
        setFormError(res.error);
        return;
      }
      setSaved(values);
      setJustSaved(true);
      toast("Venue details saved");
      router.refresh();
    });
  }

  function onCancel() {
    setValues(saved);
    setErrors({});
    setFormError(null);
  }

  const err = (k: Field) =>
    errors[k] ? (
      <FieldHint id={`v-${k}-error`} error>
        {errors[k]}
      </FieldHint>
    ) : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && <Callout tone="danger">{formError}</Callout>}

      <Card>
        <CardHeader>
          <CardTitle>Venue details</CardTitle>
          <CardDescription>Information shown to clients on your venue page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="v-name">
                Venue name <span className="ml-1 text-[13px] font-normal text-muted-foreground">required</span>
              </Label>
              <Input
                id="v-name"
                name="name"
                value={values.name}
                onChange={set("name")}
                maxLength={120}
                required
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "v-name-error" : undefined}
              />
              {err("name")}
            </div>
            <div>
              <Label htmlFor="v-timezone">Timezone</Label>
              <Select
                id="v-timezone"
                name="timezone"
                value={values.timezone}
                onChange={set("timezone")}
                aria-describedby={tzChanged ? "v-timezone-warning" : undefined}
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {tzChanged && (
            <div id="v-timezone-warning">
              <Callout tone="warning">
                Changing the timezone changes how existing bookings are displayed and when reminders
                are sent. Booking times are stored as exact moments and are not converted. Review
                your calendar after saving.
              </Callout>
            </div>
          )}
          <div>
            <Label htmlFor="v-description">Description</Label>
            <Textarea
              id="v-description"
              name="description"
              value={values.description}
              onChange={set("description")}
              maxLength={2000}
              placeholder="Tell clients what makes your venue special…"
              aria-describedby="v-description-hint"
            />
            <FieldHint id="v-description-hint">Shown on your public booking page.</FieldHint>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact information</CardTitle>
          <CardDescription>Used for booking notifications and client replies.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="v-email">Contact email</Label>
              <Input
                id="v-email"
                name="email"
                type="email"
                value={values.email}
                onChange={set("email")}
                placeholder="bookings@yourvenue.com"
                autoComplete="email"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "v-email-error v-email-hint" : "v-email-hint"}
              />
              {err("email")}
              <FieldHint id="v-email-hint">
                Tour requests are sent here, and client emails reply to this address.
              </FieldHint>
            </div>
            <div>
              <Label htmlFor="v-phone">Phone</Label>
              <Input
                id="v-phone"
                name="phone"
                type="tel"
                value={values.phone}
                onChange={set("phone")}
                placeholder="+1 555 000 0000"
                autoComplete="tel"
                maxLength={30}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>Your venue&apos;s physical location.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="v-addressLine1">Street address</Label>
            <Input
              id="v-addressLine1"
              name="addressLine1"
              value={values.addressLine1}
              onChange={set("addressLine1")}
              autoComplete="address-line1"
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <div className="min-w-0">
              <Label htmlFor="v-city">City</Label>
              <Input id="v-city" name="city" value={values.city} onChange={set("city")} maxLength={100} />
            </div>
            <div className="min-w-0">
              <Label htmlFor="v-region">State / Region</Label>
              <Input id="v-region" name="region" value={values.region} onChange={set("region")} maxLength={100} />
            </div>
            <div className="min-w-0">
              <Label htmlFor="v-postalCode">Postal code</Label>
              <Input
                id="v-postalCode"
                name="postalCode"
                value={values.postalCode}
                onChange={set("postalCode")}
                autoComplete="postal-code"
                maxLength={20}
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="v-country">Country</Label>
              <Select
                id="v-country"
                name="country"
                value={values.country.toUpperCase()}
                onChange={set("country")}
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {justSaved && !dirty && (
        <p role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
          <Check className="h-4 w-4" aria-hidden />
          Saved
        </p>
      )}

      {(dirty || pending) && (
        <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:shadow-lg">
          <span className="mr-auto inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="h-2 w-2 rounded-full bg-warning" aria-hidden />
            Unsaved changes
          </span>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Discard
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}
