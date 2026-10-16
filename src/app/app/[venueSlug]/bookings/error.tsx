"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, RotateCw, WifiOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
export default function BookingError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const { venueSlug } = useParams<{ venueSlug: string }>();
  const [pending, startTransition] = useTransition();
  return <div className="max-w-3xl space-y-4"><header className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Bookings</h1><p className="text-xs text-muted-foreground">Operational records</p></header><div aria-busy={pending} className="relative space-y-3 rounded-xl border border-border bg-card p-4">{pending && <Loader2 className="absolute right-4 top-3 h-4 w-4 animate-spin text-primary" aria-label="Retrying" />}{[0, 1, 2].map((index) => <div key={index} className="h-20 rounded-lg bg-muted" />)}</div><section className="rounded-xl border border-border bg-card p-5"><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><WifiOff className="h-5 w-5" /></span><div><h2 className="font-semibold">Bookings couldn’t load</h2><p className="mt-1 text-sm text-muted-foreground">Your bookings are safe. Check your connection and try again.</p></div></div><div className="mt-5 space-y-2"><Button className="w-full" disabled={pending} onClick={() => startTransition(unstable_retry)}><RotateCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />{pending ? "Retrying…" : "Retry"}</Button><Link href={`/app/${venueSlug}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>Back to dashboard</Link></div></section></div>;
}
