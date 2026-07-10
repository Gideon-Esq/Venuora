"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import { deleteAddOnAction, upsertAddOnAction } from "@/actions/space";

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

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  price: "",
  pricingType: "FLAT",
  maxQuantity: "",
  active: true,
};

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
  const [editing, setEditing] = React.useState<string | null | false>(false); // false = closed, null = new
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setError(null);
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
    setError(null);
    setEditing(a.id);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const cents = Math.round((Number.parseFloat(form.price) || 0) * 100);
    const res = await upsertAddOnAction(slug, editing === null ? null : (editing as string), {
      name: form.name.trim(),
      description: form.description.trim(),
      priceCents: cents,
      pricingType: form.pricingType,
      maxQuantity: form.maxQuantity.trim() === "" ? null : Number.parseInt(form.maxQuantity, 10) || 1,
      active: form.active,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  const remove = async (id: string) => {
    setBusy(true);
    await deleteAddOnAction(slug, id);
    setBusy(false);
    setEditing(false);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Add add-on
        </Button>
      </div>

      {addOns.length === 0 ? (
        <Card className="p-10 text-center text-sm text-zinc-500">
          No add-ons yet. Add extras clients can book — chairs, projector, cleaning, catering…
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Charged</th>
                <th className="px-4 py-3 text-right font-medium">Max qty</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {addOns.map((a) => (
                <tr key={a.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{a.name}</div>
                    {a.description && (
                      <div className="max-w-xs truncate text-xs text-zinc-500">{a.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900">
                    {formatMoney(a.priceCents, currency)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {a.pricingType === "PER_UNIT" ? "Per unit" : "Flat fee"}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600">{a.maxQuantity ?? "—"}</td>
                  <td className="px-4 py-3">
                    {a.active ? (
                      <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
                    ) : (
                      <Badge className="bg-zinc-100 text-zinc-500">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={editing !== false} onClose={() => setEditing(false)}>
        <DialogTitle>{editing === null ? "New add-on" : "Edit add-on"}</DialogTitle>
        <DialogDescription>
          Extras clients can add to a booking — priced per unit (e.g. per chair) or as one
          flat fee.
        </DialogDescription>
        {error && (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
        <div className="space-y-3">
          <div>
            <Label htmlFor="ao-name">Name</Label>
            <Input
              id="ao-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Projector & screen"
            />
          </div>
          <div>
            <Label htmlFor="ao-desc">Description (optional)</Label>
            <Textarea
              id="ao-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="ao-price">Price</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                  $
                </span>
                <Input
                  id="ao-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ao-type">Charged</Label>
              <Select
                id="ao-type"
                value={form.pricingType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pricingType: e.target.value as "PER_UNIT" | "FLAT" }))
                }
              >
                <option value="FLAT">Flat fee (once)</option>
                <option value="PER_UNIT">Per unit</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="ao-max">Max quantity</Label>
              <Input
                id="ao-max"
                type="number"
                min={1}
                value={form.maxQuantity}
                onChange={(e) => setForm((f) => ({ ...f, maxQuantity: e.target.value }))}
                placeholder="No limit"
                disabled={form.pricingType === "FLAT"}
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 rounded border-zinc-300 accent-indigo-600"
            />
            Active — clients can select this add-on
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          {typeof editing === "string" ? (
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Remove this add-on? It stays on past bookings.")) {
                  void remove(editing);
                }
              }}
            >
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Close
            </Button>
            <Button disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save add-on"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
