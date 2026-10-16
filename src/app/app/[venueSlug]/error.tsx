"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { CircleAlert, RotateCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function VenueError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const { venueSlug } = useParams<{ venueSlug: string }>();
  const pathname = usePathname();
  const segment = pathname.split("/")[3];
  const title = segment ? ({ calendar: "Calendar", bookings: "Bookings", tours: "Tours", clients: "Clients", spaces: "Spaces", addons: "Add-ons", settings: "Settings", onboarding: "Venue setup" } as Record<string, string>)[segment] ?? "This page" : "This week";
  const [pending, startTransition] = useTransition();
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="space-y-7">
      <div><p className="mb-2 text-xs font-medium text-primary">Overview</p><h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">{title}</h1><p className="mt-2 text-sm text-muted-foreground">Your venue activity, all in one place.</p></div>
      <section aria-labelledby="venue-error-title" className="max-w-xl rounded-xl border border-border bg-danger-soft p-6 shadow-sm sm:p-7">
        <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"><CircleAlert className="h-5 w-5" aria-hidden /></span>
        <h2 id="venue-error-title" className="text-lg font-semibold">We couldn’t load {title.toLowerCase()}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your venue data didn’t come through. Try again to refresh this view.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3"><Button disabled={pending} onClick={() => startTransition(unstable_retry)}><RotateCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />{pending ? "Retrying…" : "Try again"}</Button><Link href={`/app/${venueSlug}/bookings`} className={buttonVariants({ variant: "link" })}>View bookings</Link></div>
      </section>
    </div>
  );
}
