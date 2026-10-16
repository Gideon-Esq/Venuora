// Shared option lists for venue create / settings forms.

export const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "America/Toronto", label: "Toronto" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/Amsterdam", label: "Amsterdam" },
  { value: "Africa/Lagos", label: "West Africa – Lagos" },
  { value: "Africa/Accra", label: "Accra" },
  { value: "Africa/Nairobi", label: "East Africa – Nairobi" },
  { value: "Africa/Johannesburg", label: "South Africa" },
  { value: "Asia/Dubai", label: "Gulf – Dubai" },
  { value: "Asia/Kolkata", label: "India" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Manila", label: "Philippines" },
  { value: "Asia/Tokyo", label: "Japan" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "New Zealand" },
];

export function timezoneLabel(tz: string): string {
  const found = TIMEZONES.find((t) => t.value === tz);
  return found ? `${tz} (${found.label})` : tz;
}

/** Timezone options, keeping `current` selectable even if it's not in the list. */
export function timezoneOptions(current?: string): { value: string; label: string }[] {
  const opts = TIMEZONES.map((t) => ({ value: t.value, label: timezoneLabel(t.value) }));
  if (current && !TIMEZONES.some((t) => t.value === current)) {
    return [{ value: current, label: current }, ...opts];
  }
  return opts;
}

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "PT", name: "Portugal" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "IN", name: "India" },
  { code: "SG", name: "Singapore" },
  { code: "PH", name: "Philippines" },
  { code: "JP", name: "Japan" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
];

export function countryOptions(current?: string): { code: string; name: string }[] {
  const cur = current?.toUpperCase();
  if (cur && !COUNTRIES.some((c) => c.code === cur)) return [{ code: cur, name: cur }, ...COUNTRIES];
  return COUNTRIES;
}
