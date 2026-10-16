import { Skeleton } from "@/components/ui/skeleton";

const bone = "rounded bg-accent";

export default function CalendarLoading() {
  return (
    <div className="space-y-5" role="status" aria-busy="true" aria-label="Loading calendar">
      <span className="sr-only">Loading venue availability…</span>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2"><Skeleton className={`${bone} h-8 w-36`} /><Skeleton className={`${bone} h-3 w-52 max-w-full`} /></div>
        <div className="flex gap-2"><Skeleton className={`${bone} h-9 w-40`} /><Skeleton className={`${bone} hidden h-9 w-28 sm:block`} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-3"><Skeleton className={`${bone} h-9 w-32`} /><Skeleton className={`${bone} h-9 w-36`} /><Skeleton className={`${bone} ml-auto h-9 w-24`} /></div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border bg-background py-3">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className={`${bone} mx-auto h-3 w-6 sm:w-12`} />)}</div>
        <div className="grid grid-cols-7">{Array.from({ length: 35 }, (_, index) => <div key={index} className="min-h-14 border-r border-b border-border p-2 last:border-b-0 sm:min-h-24 lg:min-h-28 [&:nth-child(7n)]:border-r-0"><Skeleton className={`${bone} h-4 w-4 rounded-full`} />{index % 5 === 2 && <><Skeleton className={`${bone} mt-3 hidden h-5 w-full sm:block`} /><Skeleton className={`${bone} mx-auto mt-2 h-1 w-1 rounded-full sm:hidden`} /></>}</div>)}</div>
      </div>
      <div className="space-y-3 sm:hidden"><Skeleton className={`${bone} h-5 w-48`} />{[0, 1].map((row) => <div key={row} className="space-y-3 rounded-xl border border-border bg-card p-4"><Skeleton className={`${bone} h-4 w-28`} /><Skeleton className={`${bone} h-3 w-40`} /><Skeleton className={`${bone} h-3 w-52 max-w-full`} /></div>)}</div>
    </div>
  );
}
