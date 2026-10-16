"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateClientAction } from "../actions";

type ClientFields = {
  name: string;
  phone: string;
  email: string;
  organization: string;
  notes: string;
};

interface Props {
  slug: string;
  clientId: string;
  initial: ClientFields;
}

type Errors = Partial<Record<keyof ClientFields | "form", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(f: ClientFields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Name is required";
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email address";
  return e;
}

/** Maps the action's single error message onto the most likely field. */
function mapServerError(msg: string): Errors {
  const m = msg.toLowerCase();
  if (m.includes("name")) return { name: msg };
  if (m.includes("email")) return { email: msg };
  if (m.includes("phone")) return { phone: msg };
  return { form: msg };
}

export function ClientEditButton({ slug, clientId, initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(initial);
  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);

  function openDialog() {
    setForm(initial);
    setErrors({});
    setOpen(true);
  }

  const set =
    (key: keyof ClientFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [key]: value }));
      if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
    };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const local = validate(form);
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const res = await updateClientAction(slug, clientId, form);
      if (res.ok) {
        setOpen(false);
        toast("Client details saved");
        router.refresh();
      } else {
        setErrors(mapServerError(res.error));
      }
    } catch {
      setErrors({ form: "Could not save — please try again." });
    } finally {
      setSaving(false);
    }
  }

  const fieldProps = (key: keyof ClientFields) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `client-${key}-error` : undefined,
  });

  const errorHint = (key: keyof ClientFields) =>
    errors[key] ? (
      <FieldHint id={`client-${key}-error`} error>
        {errors[key]}
      </FieldHint>
    ) : null;

  return (
    <>
      <Button onClick={openDialog}>
        <Pencil className="h-4 w-4" aria-hidden />
        Edit client
      </Button>

      <Dialog open={open} onClose={() => !saving && setOpen(false)}>
        <DialogTitle>Edit client</DialogTitle>
        <DialogDescription>
          Keep this up to date so quotes and reminders reach them.
        </DialogDescription>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          {errors.form && <Callout tone="danger">{errors.form}</Callout>}
          <div>
            <Label htmlFor="client-name">Name</Label>
            <Input
              id="client-name"
              value={form.name}
              onChange={set("name")}
              required
              autoComplete="off"
              {...fieldProps("name")}
            />
            {errorHint("name")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="client-phone">Phone</Label>
              <Input
                id="client-phone"
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+1 555 000 0000"
                {...fieldProps("phone")}
              />
              {errorHint("phone")}
            </div>
            <div>
              <Label htmlFor="client-email">Email</Label>
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="name@example.com"
                {...fieldProps("email")}
              />
              {errorHint("email")}
            </div>
          </div>
          <div>
            <Label htmlFor="client-organization">Organisation</Label>
            <Input
              id="client-organization"
              value={form.organization}
              onChange={set("organization")}
              placeholder="Company, church, association…"
              {...fieldProps("organization")}
            />
            {errorHint("organization")}
          </div>
          <div>
            <Label htmlFor="client-notes">Internal notes</Label>
            <Textarea
              id="client-notes"
              value={form.notes}
              onChange={set("notes")}
              placeholder="Preferences, past issues, VIP…"
              {...fieldProps("notes")}
            />
            {errors.notes ? errorHint("notes") : <FieldHint>Only your team sees these.</FieldHint>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
