"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publishVenueAction } from "@/actions/venue";

export function PublishButton({
  slug,
  published,
  publicUrl,
}: {
  slug: string;
  published: boolean;
  publicUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [justPublished, setJustPublished] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  if (published || justPublished) {
    return (
      <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-center gap-2 font-medium text-emerald-900">
          <PartyPopper className="h-4 w-4" /> Your venue page is live!
        </p>
        <p className="text-sm text-emerald-800">
          Share this link anywhere — WhatsApp, Instagram bio, flyers. Clients can browse,
          inquire and book from it.
        </p>
        <div className="flex items-center gap-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 text-xs text-indigo-700 underline"
          >
            {publicUrl}
          </a>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(publicUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                window.prompt("Copy this link:", publicUrl);
              }
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}
      <Button
        size="lg"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await publishVenueAction(slug);
          setBusy(false);
          if (res.ok) {
            setJustPublished(true);
            router.refresh();
          } else {
            setError(res.error);
          }
        }}
      >
        {busy ? "Publishing…" : "Publish my venue page"}
      </Button>
    </div>
  );
}
