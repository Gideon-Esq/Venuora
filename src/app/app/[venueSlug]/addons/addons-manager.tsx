"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { upsertAddOnAction } from "@/actions/space";

export interface AddOnRow {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  pricingType: "PER_UNIT" | "FLAT";
  maxQuantity: number | null;
  active: boolean;
}

interface FormState {
  name: string;
  description: string;
  price: string;
  pricingType: "PER_UNIT" | "FLAT";
  maxQuantity: string;
  active: boolean;
}

type FieldErrors = Partial<Record<"name" | "description" | "price" | "maxQuantity", string>>;

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  price: "",
  pricingType: "FLAT",
  maxQuantity: "",
  active: true,
};

/** The currency symbol on its own (e.g. "$", "€"), for the price-input prefix. */
function currencySymbol(currency: string): string {
  return formatMoney(0, currency).replace(/[\d\s.,]/g, "") || currency.toUpperCase();
}

function pricingLabel(a: AddOnRow, currency: string): string {
  return `${formatMoney(a.priceCents, currency)} ${a.pricingType === "FLAT" ? "flat fee" : "per unit"}`;
}

function maxLabel(a: AddOnRow): string {
  if (a.pricingType === "FLAT") return "1";
  return a.maxQuantity == null ? "No limit" : String(a.maxQuantity);
}

/** Full payload for upsertAddOnAction from an existing row. */
function rowPayload(a: AddOnRow, active: boolean) {
  return {
    name: a.name,
    description: a.description ?? "",
    priceCents: a.priceCents,
    pricingType: a.pricingType,
    maxQuantity: a.maxQuantity,
    active,
  };
}

function validate(form: FormState): { errors: FieldErrors; priceCents: number; max: number | null } {
  const errors: FieldErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Give the add-on a name clients will recognise.";
  else if (name.length > 120) errors.name = "Keep the name under 120 characters.";
  if (form.description.trim().length > 500)
    errors.description = "Keep the description under 500 characters.";

  const priceNum = Number.parseFloat(form.price);
  let priceCents = 0;
  if (form.price.trim() === "" || Number.isNaN(priceNum)) errors.price = "Enter a price (0 for free).";
  else if (priceNum < 0) errors.price = "The price can't be negative.";
  else if (priceNum > 1_000_000) errors.price = "That price is too high.";
  else priceCents = Math.round(priceNum * 100);

  let max: number | null = null;
  if (form.pricingType === "PER_UNIT" && form.maxQuantity.trim() !== "") {
    const n = Number(form.maxQuantity);
    if (!Number.isInteger(n) || n < 1 || n > 10_000)
      errors.maxQuantity = "Use a whole number from 1 to 10,000, or leave it empty for no limit.";
    else max = n;
  }
  return { errors, priceCents, max };
}

export function AddOnsManager({
  slug,
  addOns,
  currency,
}: {
  slug: string;
  addOns: AddOnRow[];
  currency: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = React.useState<string | null | false>(false); // false = closed, null = new
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [busy, setBusy] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const [optimisticRows, setOptimistic] = React.useOptimistic(
    addOns,
    (rows: AddOnRow[], change: { id: string; active: boolean }) =>
      rows.map((r) => (r.id === change.id ? { ...r, active: change.active } : r))
  );
  const [, startTransition] = React.useTransition();

  const symbol = currencySymbol(currency);
  const hasInactive = optimisticRows.some((r) => !r.active);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setServerError(null);
    setEditing(null);
  };

  const openEdit = (a: AddOnRow) => {
    setForm({
      name: a.name,
      description: a.description ?? "",
      price: (a.priceCents / 100).toFixed(a.priceCents % 100 === 0 ? 0 : 2),
      pricingType: a.pricingType,
      maxQuantity: a.maxQuantity == null ? "" : String(a.maxQuantity),
      active: a.active,
    });
    setErrors({});
    setServerError(null);
    setEditing(a.id);
  };

  const toggle = (a: AddOnRow, active: boolean) => {
    startTransition(async () => {
      setOptimistic({ id: a.id, active });
      try {
        const res = await upsertAddOnAction(slug, a.id, rowPayload(a, active));
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        toast(active ? `${a.name} is offered to new bookings.` : `${a.name} is no longer offered.`);
        router.refresh();
      } catch {
        toast("Couldn't update the add-on — please try again.", "error");
      }
    });
  };

  const save = async () => {
    const { errors: errs, priceCents, max } = validate(form);
    setErrors(errs);
    setServerError(null);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    try {
      const res = await upsertAddOnAction(slug, editing === null ? null : (editing as string), {
        name: form.name.trim(),
        description: form.description.trim(),
        priceCents,
        pricingType: form.pricingType,
        maxQuantity: form.pricingType === "FLAT" ? null : max,
        active: form.active,
      });
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      toast(editing === null ? "Add-on created." : "Add-on saved.");
      setEditing(false);
      router.refresh();
    } catch {
      setServerError("Couldn't save the add-on — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add-ons"
        description="Optional extras clients can select for their booking."
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden /> Add add-on
          </Button>
        }
      />

      <Callout tone="info">
        Add-ons are shown during online booking and included in the booking total. Phone bookings
        don&apos;t include add-ons yet.
      </Callout>

      {optimisticRows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="No add-ons yet"
            description="Add extras clients can book with their space — chairs, a projector, cleaning, catering…"
            action={
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" aria-hidden /> Add your first add-on
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-5 py-3">Add-on</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Pricing</th>
                  <th scope="col" className="px-4 py-3">Maximum quantity</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {optimisticRows.map((a) => (
                  <tr key={a.id} className="border-t border-border transition-colors hover:bg-muted/40">
                    <td className="px-5 py-4 align-top">
                      <AddOnName addOn={a} />
                    </td>
                    <td className="px-4 py-4">
                      <ActiveSwitch addOn={a} onChange={(v) => toggle(a, v)} />
                    </td>
                    <td className="px-4 py-4 text-foreground">{pricingLabel(a, currency)}</td>
                    <td className="px-4 py-4 text-foreground">{maxLabel(a)}</td>
                    <td className="px-5 py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                        <span className="sr-only"> {a.name}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {optimisticRows.map((a) => (
              <li key={a.id}>
                <Card className="p-4">
                  <AddOnName addOn={a} />
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Pricing
                      </dt>
                      <dd className="mt-0.5 text-foreground">{pricingLabel(a, currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Max quantity
                      </dt>
                      <dd className="mt-0.5 text-foreground">{maxLabel(a)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <ActiveSwitch addOn={a} onChange={(v) => toggle(a, v)} large />
                    <Button variant="outline" className="h-11" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" aria-hidden /> Edit
                      <span className="sr-only"> {a.name}</span>
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {hasInactive && (
            <p className="text-sm text-muted-foreground">
              Inactive add-ons stay on past bookings and can be switched back on any time.
            </p>
          )}
        </>
      )}

      <Dialog open={editing !== false} onClose={() => setEditing(false)}>
        <DialogTitle>{editing === null ? "New add-on" : "Edit add-on"}</DialogTitle>
        <DialogDescription>
          Priced per unit (e.g. per chair) or as one flat fee. Price changes only affect new
          bookings.
        </DialogDescription>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-4"
        >
          {serverError && <Callout tone="danger">{serverError}</Callout>}
          <div>
            <Label htmlFor="ao-name">Name</Label>
            <Input
              id="ao-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Projector & screen"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "ao-name-err" : undefined}
            />
            {errors.name && (
              <FieldHint id="ao-name-err" error>
                {errors.name}
              </FieldHint>
            )}
          </div>
          <div>
            <Label htmlFor="ao-desc">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="ao-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What's included — shown to clients when they book."
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={errors.description ? "ao-desc-err" : undefined}
            />
            {errors.description && (
              <FieldHint id="ao-desc-err" error>
                {errors.description}
              </FieldHint>
            )}
          </div>

          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-foreground">Charged</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1">
              {(
                [
                  ["FLAT", "Flat fee"],
                  ["PER_UNIT", "Per unit"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                    form.pricingType === value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <input
                    type="radio"
                    name="ao-pricing"
                    value={value}
                    checked={form.pricingType === value}
                    onChange={() => set("pricingType", value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
            <FieldHint>
              {form.pricingType === "FLAT"
                ? "Charged once per booking."
                : "Clients choose how many; charged for each one."}
            </FieldHint>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ao-price">Price</Label>
              <div className="relative">
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                >
                  {symbol}
                </span>
                <Input
                  id="ao-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  style={{ paddingLeft: `${Math.max(1.75, symbol.length * 0.6 + 1)}rem` }}
                  placeholder="0.00"
                  aria-invalid={errors.price ? true : undefined}
                  aria-describedby={errors.price ? "ao-price-err" : undefined}
                />
              </div>
              {errors.price && (
                <FieldHint id="ao-price-err" error>
                  {errors.price}
                </FieldHint>
              )}
            </div>
            <div>
              <Label htmlFor="ao-max">Max quantity</Label>
              <Input
                id="ao-max"
                type="number"
                inputMode="numeric"
                min={1}
                value={form.pricingType === "FLAT" ? "1" : form.maxQuantity}
                onChange={(e) => set("maxQuantity", e.target.value)}
                placeholder="No limit"
                disabled={form.pricingType === "FLAT"}
                aria-invalid={errors.maxQuantity ? true : undefined}
                aria-describedby={errors.maxQuantity ? "ao-max-err" : "ao-max-hint"}
              />
              {errors.maxQuantity ? (
                <FieldHint id="ao-max-err" error>
                  {errors.maxQuantity}
                </FieldHint>
              ) : (
                <FieldHint id="ao-max-hint">
                  {form.pricingType === "FLAT"
                    ? "Flat fees are added once."
                    : "Leave empty for no limit."}
                </FieldHint>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
            <div>
              <p id="ao-active-label" className="text-sm font-medium text-foreground">
                Offered to new bookings
              </p>
              <p id="ao-active-hint" className="text-[13px] text-muted-foreground">
                Clients can select this add-on when booking online.
              </p>
            </div>
            <SwitchControl
              checked={form.active}
              onChange={(v) => set("active", v)}
              labelledBy="ao-active-label"
              describedBy="ao-active-hint"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}

function AddOnName({ addOn }: { addOn: AddOnRow }) {
  return (
    <div className="min-w-0">
      <p className={cn("font-medium", addOn.active ? "text-foreground" : "text-muted-foreground")}>
        {addOn.name}
      </p>
      {addOn.description && (
        <p className="mt-0.5 line-clamp-2 max-w-sm text-[13px] text-muted-foreground">
          {addOn.description}
        </p>
      )}
      {!addOn.active && (
        <p className="mt-1 text-xs font-medium text-muted-foreground">Not offered to new bookings</p>
      )}
    </div>
  );
}

function ActiveSwitch({
  addOn,
  onChange,
  large = false,
}: {
  addOn: AddOnRow;
  onChange: (v: boolean) => void;
  large?: boolean;
}) {
  return (
    <SwitchControl
      checked={addOn.active}
      onChange={onChange}
      label={`${addOn.name}: offered to new bookings`}
      text={addOn.active ? "Offered to new bookings" : "Not offered"}
      large={large}
    />
  );
}

/** Accessible switch (button role="switch"). `text` is shown beside it so state isn't colour-only. */
function SwitchControl({
  checked,
  onChange,
  label,
  labelledBy,
  describedBy,
  text,
  large = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  text?: string;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex shrink-0 items-center gap-2.5 rounded-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        large ? "min-h-11" : "min-h-10"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex shrink-0 items-center rounded-full transition-colors",
          large ? "h-7 w-12" : "h-6 w-11",
          checked ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "inline-block rounded-full bg-white shadow transition-transform",
            large ? "h-6 w-6" : "h-5 w-5",
            checked ? (large ? "translate-x-[22px]" : "translate-x-5") : "translate-x-0.5"
          )}
        />
      </span>
      {text && (
        <span
          aria-hidden
          className={cn("text-[13px] font-medium", checked ? "text-foreground" : "text-muted-foreground")}
        >
          {text}
        </span>
      )}
    </button>
  );
}
