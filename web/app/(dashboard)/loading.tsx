import { ReviewsTableSkeleton } from "@/components/ReviewsTable";
import { StatCardsSkeleton } from "@/components/StatCards";
import { Skeleton } from "@/components/states";

export default function Loading() {
  return (
    <>
      <div className="mb-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <StatCardsSkeleton />
      <div className="mt-12">
        <Skeleton className="mb-4 h-3 w-32" />
        <ReviewsTableSkeleton rows={6} />
      </div>
    </>
  );
}
