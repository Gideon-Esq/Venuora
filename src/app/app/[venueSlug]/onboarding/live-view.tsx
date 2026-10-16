import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ExternalLink,
  Globe,
  Lock,
  MinusCircle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CopyLinkButton } from "./publish-button";

export type LiveStep = { key: string; title: string; done: boolean; optional?: boolean; href?: string };

/** Success layout shown once the venue page is published. */
export function LiveView({
  slug,
  venueName,
  publicUrl,
  steps,
}: {
  slug: string;
  venueName: string;
  publicUrl: string;
  steps: LiveStep[];
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </span>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Publish complete
        </p>
        <h1 className="mt-2 text-balance text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[32px]">
          Your venue is live
        </h1>
        <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">
          Clients can now discover {venueName} and request or book available spaces.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Public venue page</CardTitle>
          <CardDescription>Share this link with clients to start receiving bookings.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted p-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all px-1 font-mono text-sm text-foreground sm:truncate">
              {publicUrl}
            </code>
            <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
              <CopyLinkButton url={publicUrl} />
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants(), "w-full sm:w-auto")}
              >
                <ExternalLink className="h-4 w-4" aria-hidden /> Open public page
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>{allDone ? "Setup complete" : "Setup progress"}</CardTitle>
            <Badge variant={allDone ? "success" : "muted"}>
              {doneCount} of {steps.length}
            </Badge>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {steps.map((s) => (
                <li key={s.key} className="flex items-center gap-3 text-sm">
                  {s.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
                  ) : s.optional ? (
                    <MinusCircle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-warning" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 text-foreground">
                    {s.title}
                    {!s.done && s.optional && (
                      <span className="ml-1.5 text-muted-foreground">optional</span>
                    )}
                    <span className="sr-only">
                      {s.done ? " (complete)" : s.optional ? " (skipped)" : " (to do)"}
                    </span>
                  </span>
                  {!s.done && !s.optional && s.href && (
                    <Link href={s.href} className="shrink-0 font-medium text-primary hover:underline">
                      Finish
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle>What changed</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                Your public page is visible to clients.
              </li>
              <li className="flex items-start gap-3">
                <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                Active spaces can receive new bookings.
              </li>
              <li className="flex items-start gap-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                Existing booking prices are unchanged.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Callout tone="info">
        <span className="font-semibold">Publish status:</span> Your venue page is live and ready for
        clients to visit.
      </Callout>

      <div className="flex justify-end border-t border-border pt-6">
        <Link href={`/app/${slug}`} className={cn(buttonVariants(), "w-full sm:w-auto")}>
          View dashboard <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
