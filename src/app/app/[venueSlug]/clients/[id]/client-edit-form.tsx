"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { updateClientAction } from "../actions";

interface Props {
  slug: string;
  clientId: string;
  initial: {
    name: string;
    phone: string;
    email: string;
    organization: string;
    notes: string;
  };
}

export function ClientEditForm({ slug, clientId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        const res = await updateClientAction(slug, clientId, form);
        setSaving(false);
        if (res.ok) {
          setMessage({ ok: true, text: "Saved." });
          router.refresh();
        } else {
          setMessage({ ok: false, text: res.error });
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
      <div>
        <Label htmlFor="client-name">Name</Label>
        <Input id="client-name" value={form.name} onChange={set("name")} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="client-phone">Phone</Label>
          <Input id="client-phone" value={form.phone} onChange={set("phone")} placeholder="+1 555 000 0000" />
        </div>
        <div>
          <Label htmlFor="client-email">Email</Label>
          <Input id="client-email" type="email" value={form.email} onChange={set("email")} placeholder="name@example.com" />
        </div>
      </div>
      <div>
        <Label htmlFor="client-org">Organization</Label>
        <Input id="client-org" value={form.organization} onChange={set("organization")} placeholder="Company, church, association…" />
      </div>
      <div>
        <Label htmlFor="client-notes">Notes (only your team sees these)</Label>
        <Textarea id="client-notes" value={form.notes} onChange={set("notes")} placeholder="Preferences, past issues, VIP…" />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
