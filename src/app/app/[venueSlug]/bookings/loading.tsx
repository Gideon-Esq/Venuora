import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function BookingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading bookings…</span>
      <div className="flex items-center justify-between gap-4 sm:items-start">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="hidden h-4 w-80 sm:block" />
        </div>
        <Skeleton className="h-10 w-20 sm:w-36" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-xl" />
        <div className="flex gap-4 overflow-hidden border-b border-border pb-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-20 shrink-0" />
          ))}
        </div>
      </div>

      <Card className="hidden overflow-hidden md:block">
        <div className="h-11 bg-muted" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-t border-border px-4 py-4">
            <div className="w-32 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </Card>

      <div className="space-y-3 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-2 h-4 w-44" />
            <Skeleton className="mt-1.5 h-4 w-24" />
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
