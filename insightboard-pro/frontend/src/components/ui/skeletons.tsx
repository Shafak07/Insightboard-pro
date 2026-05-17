import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-lg border border-border p-4", className)}>
      <Skeleton className="h-5 w-40" />
      <div className="flex h-[280px] items-end gap-2 pt-4">
        {[35, 55, 40, 70, 50, 85, 60, 45, 75, 55].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 animate-pulse rounded-t-md"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function DashboardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <DatasetCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DatasetCardSkeleton() {
  return (
    <div className="rounded-lg border border-border p-4">
      <Skeleton className="mb-3 h-5 w-3/4" />
      <Skeleton className="mb-4 h-3 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
      </div>
    </div>
  );
}
