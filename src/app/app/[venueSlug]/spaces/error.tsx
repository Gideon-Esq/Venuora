"use client";
import { useTransition } from "react";
import { RotateCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function SpacesError({unstable_retry}: {error:Error & {digest?:string};unstable_retry:()=>void}) {
  const [pending,startTransition] = useTransition();
  return <section className="rounded-xl border border-border bg-card p-6"><h1 className="text-2xl font-semibold">Spaces</h1><div className="mt-6 flex items-start gap-3"><AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden /><div><h2 className="font-semibold">Spaces couldn’t load</h2><p className="mt-2 text-sm text-muted-foreground">Your saved spaces are safe. Try again to refresh this list.</p></div></div><Button className="mt-5" disabled={pending} onClick={()=>startTransition(unstable_retry)}><RotateCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />{pending ? "Retrying…" : "Retry"}</Button></section>;
}
