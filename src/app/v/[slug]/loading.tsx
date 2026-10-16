import { Skeleton } from "@/components/ui/skeleton";
export default function VenueLoading() {
  return <main role="status" aria-busy="true" className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8"><span className="sr-only">Loading venue details…</span><Skeleton className="h-10 w-48" /><Skeleton className="aspect-[16/7] w-full" /><Skeleton className="h-8 w-64 max-w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><div className="grid gap-5 sm:grid-cols-2">{[1,2].map(i=><div key={i} className="space-y-4 rounded-xl border border-border bg-card p-4"><Skeleton className="aspect-[3/2] w-full" /><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-11 w-full" /></div>)}</div></main>;
}
