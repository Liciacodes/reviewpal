import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ReviewsList } from "@/components/ReviewsTable";

export const metadata: Metadata = { title: "Reviews" };

export default function ReviewsPage() {
  return (
    <>
      <PageHeader title="Reviews" description="The 50 most recent pull request reviews." />
      <ReviewsList />
    </>
  );
}
