import { Skeleton } from "@/components/ui/skeleton";
export default function QuoteLoading() {
  return <main role="status" aria-busy="true" className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8"><span className="sr-only">Loading your private quote…</span><Skeleton className="h-8 w-60 max-w-full" />{[1,2,3].map(i=><div key={i} className="space-y-4 rounded-xl border border-border bg-card p-5"><Skeleton className="h-5 w-32" /><Skeleton className="h-20 w-full" /><Skeleton className="h-4 w-2/3" /></div>)}</main>;
}
