import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton({ lines = 3, tall }: { lines?: number; tall?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <Skeleton className="h-5 w-40" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={tall ? "h-12 w-full" : "h-4 w-full"} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only" role="status">
        Loading booking…
      </span>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-52" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 rounded-xl border border-border bg-card p-6 md:flex md:items-center md:gap-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-28" />
          </div>
        ))}
        <Skeleton className="col-span-2 h-9 w-36 rounded-full md:ml-auto" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="space-y-6">
          <CardSkeleton lines={2} tall />
          <CardSkeleton lines={2} tall />
          <CardSkeleton lines={4} />
        </div>
        <div className="space-y-6">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    </div>
  );
}
