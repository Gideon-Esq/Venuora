import { Skeleton } from "@/components/ui/skeleton";
export default function TourLoading() {
  return <main role="status" aria-busy="true" className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8"><span className="sr-only">Loading the tour request form…</span><Skeleton className="h-8 w-72 max-w-full" /><Skeleton className="h-4 w-full max-w-lg" /><div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]"><div className="space-y-5 rounded-xl border border-border bg-card p-6">{[1,2,3,4].map(i=><div key={i} className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-11 w-full" /></div>)}<Skeleton className="h-24 w-full" /><Skeleton className="h-12 w-full" /></div><Skeleton className="hidden h-48 md:block" /></div></main>;
}
