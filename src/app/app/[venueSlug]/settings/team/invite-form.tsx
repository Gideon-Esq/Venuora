"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { inviteMemberAction } from "./actions";

export function InviteForm({ slug }: { slug: string }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      ref={formRef}
      className="space-y-3"
      action={async (formData: FormData) => {
        setSaving(true);
        setMessage(null);
        const res = await inviteMemberAction(slug, formData);
        setSaving(false);
        if (res.ok) {
          setMessage({
            ok: true,
            text: "Member added. They can sign in with a magic link sent to their email — no password needed.",
          });
          formRef.current?.reset();
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
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            placeholder="teammate@example.com"
            required
          />
        </div>
        <div className="w-36">
          <Label htmlFor="invite-role">Role</Label>
          <Select id="invite-role" name="role" defaultValue="STAFF">
            <option value="STAFF">Staff</option>
            <option value="MANAGER">Manager</option>
            <option value="OWNER">Owner</option>
          </Select>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Inviting…" : "Invite"}
        </Button>
      </div>
    </form>
  );
}
