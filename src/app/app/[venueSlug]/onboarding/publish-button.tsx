"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2, RotateCw, Rocket } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { publishVenueAction } from "@/actions/venue";
import { cn } from "@/lib/utils";

export function PublishPanel({
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
  const live = published || justPublished;

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await publishVenueAction(slug);
      if (res.ok) {
        setJustPublished(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong on our side. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Callout
          tone="danger"
          title="We couldn’t publish your venue page. Your saved setup is safe."
          action={
            <Button type="button" variant="outline" size="sm" onClick={publish} disabled={busy}>
              <RotateCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} aria-hidden /> Retry
            </Button>
          }
        >
          {error}
        </Callout>
      )}

      {justPublished && (
        <Callout tone="success" title="Your venue page is live">
          Share the link below anywhere: WhatsApp, your Instagram bio, flyers. Clients can browse,
          inquire and book from it.
        </Callout>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Share your venue page</CardTitle>
          <CardDescription>
            {live
              ? "Clients can browse, inquire and book from this link."
              : "Your public link will be available after publishing."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ShareField url={live ? publicUrl : null} />
          {live && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> View public page
            </a>
          )}
        </CardContent>
      </Card>

      {!live && (
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          disabled={busy}
          onClick={publish}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Rocket className="h-4 w-4" aria-hidden />
          )}
          {busy ? "Publishing…" : "Publish my venue page"}
        </Button>
      )}
    </div>
  );
}

function ShareField({ url }: { url: string | null }) {
  const [copied, setCopied] = React.useState(false);
  const id = React.useId();

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <div>
      <Label htmlFor={id} className="sr-only">
        Public venue page link
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          readOnly
          value={url ?? ""}
          placeholder="Public URL will appear here"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1"
        />
        <Button type="button" variant="outline" onClick={copy} disabled={!url} className="shrink-0">
          {copied ? (
            <Check className="h-4 w-4 text-success" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}

/** Standalone "Copy link" button for the published view. */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt("Copy this link:", url);
          }
        }}
      >
        {copied ? (
          <Check className="h-4 w-4 text-success" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        {copied ? "Copied" : "Copy link"}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </>
  );
}
