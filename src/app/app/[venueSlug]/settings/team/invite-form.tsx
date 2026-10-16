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
        try {
        const res = await inviteMemberAction(slug, formData);

        if (res.ok) {
          setMessage({
            ok: true,
            text: "Member added. Ask them to request a sign-in link using this email.",
          });
          formRef.current?.reset();
          router.refresh();
        } else {
          setMessage({ ok: false, text: res.error });
        }
        } catch { setMessage({ok:false,text:"Could not add this person. Please try again."}); } finally { setSaving(false); }
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
      <div className="space-y-4">
        <div className="min-w-0">
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
        <p className="rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">This adds team access. No invitation email is sent; the person must sign in using this email address.</p>
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Adding…" : "Add person"}
        </Button>
      </div>
    </form>
  );
}
