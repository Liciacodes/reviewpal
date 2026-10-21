import { ReviewsTableSkeleton } from "@/components/ReviewsTable";
import { Skeleton } from "@/components/states";

export default function Loading() {
  return (
    <>
      <div className="mb-10">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      </div>
      <ReviewsTableSkeleton rows={8} />
    </>
  );
}
