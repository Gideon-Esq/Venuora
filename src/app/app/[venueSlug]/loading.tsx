import { Skeleton } from "@/components/ui/skeleton";

const bone = "rounded bg-accent";
const surface = "overflow-hidden rounded-xl border border-border bg-card";

export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading this week" className="space-y-6">
      <span className="sr-only">Loading your venue dashboard…</span>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2"><Skeleton className={`${bone} h-8 w-44`} /><Skeleton className={`${bone} h-4 w-56 max-w-full`} /></div>
        <Skeleton className={`${bone} hidden h-9 w-28 sm:block`} />
      </div>
      <div className={`${surface} flex items-center gap-4 p-5`}>
        <div className="min-w-0 flex-1 space-y-2"><Skeleton className={`${bone} h-4 w-56 max-w-full`} /><Skeleton className={`${bone} h-3 w-96 max-w-full`} /></div><Skeleton className={`${bone} h-9 w-24 shrink-0`} />
      </div>
      <section className="space-y-3"><Skeleton className={`${bone} h-4 w-36`} /><div className={`${surface} divide-y divide-border`}>
        {[0, 1, 2].map((row) => <div key={row} className="flex items-center gap-4 p-5"><Skeleton className={`${bone} h-9 w-9 shrink-0`} /><div className="min-w-0 flex-1 space-y-2"><Skeleton className={`${bone} h-3 w-48 max-w-full`} /><Skeleton className={`${bone} h-3 w-72 max-w-full`} /></div><Skeleton className={`${bone} h-8 w-20 shrink-0`} /></div>)}
      </div></section>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="space-y-3"><Skeleton className={`${bone} h-4 w-24`} /><div className={`${surface} space-y-4 p-5`}><div className="flex justify-between gap-3"><div className="min-w-0 flex-1 space-y-3"><Skeleton className={`${bone} h-4 w-56 max-w-full`} /><Skeleton className={`${bone} h-3 w-40 max-w-full`} /><Skeleton className={`${bone} h-3 w-64 max-w-full`} /></div><Skeleton className={`${bone} h-6 w-16 rounded-full`} /></div><div className="space-y-3 border-t border-border pt-4">{[0, 1].map((row) => <div key={row} className="flex justify-between"><Skeleton className={`${bone} h-3 w-36`} /><Skeleton className={`${bone} h-5 w-10 rounded-full`} /></div>)}</div></div></section>
        <section className="space-y-3"><Skeleton className={`${bone} h-4 w-28`} /><div className={`${surface} divide-y divide-border`}>{[0, 1, 2].map((row) => <div key={row} className="flex items-center gap-3 p-4"><Skeleton className={`${bone} h-9 w-9`} /><div className="min-w-0 flex-1 space-y-2"><Skeleton className={`${bone} h-3 w-40 max-w-full`} /><Skeleton className={`${bone} h-3 w-28 max-w-full`} /></div><Skeleton className={`${bone} h-3 w-3`} /></div>)}</div></section>
      </div>
      <section className="space-y-3"><Skeleton className={`${bone} h-4 w-36`} /><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map((stat) => <div key={stat} className={`${surface} space-y-3 p-5`}><Skeleton className={`${bone} h-3 w-24 max-w-full`} /><Skeleton className={`${bone} h-7 w-20`} /><Skeleton className={`${bone} h-3 w-32 max-w-full`} /></div>)}</div></section>
    </div>
  );
}
