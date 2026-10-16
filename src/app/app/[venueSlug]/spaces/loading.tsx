import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SpacesLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only" role="status">
        Loading spaces…
      </span>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Skeleton className="h-11 w-full sm:w-64" />
        <Skeleton className="h-10 w-full sm:w-80" />
      </div>
      <Card className="overflow-hidden">
        <div className="hidden h-11 bg-muted/70 md:block" />
        <div className="divide-y divide-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <Skeleton className="h-11 w-16 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="hidden h-5 w-16 md:block" />
              <Skeleton className="hidden h-4 w-28 md:block" />
              <Skeleton className="hidden h-4 w-36 lg:block" />
              <Skeleton className="hidden h-4 w-20 lg:block" />
              <Skeleton className="hidden h-8 w-28 md:block" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
