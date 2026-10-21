import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewDetail, ReviewDetailSkeleton } from "@/components/review/ReviewDetail";

export const metadata: Metadata = { title: "Review" };

// The id is only known at request time, so the client part reads it inside <Suspense>
export default function ReviewPage({ params }: PageProps<"/reviews/[id]">) {
  return (
    <Suspense fallback={<ReviewDetailSkeleton />}>
      <ReviewDetail params={params} />
    </Suspense>
  );
}
