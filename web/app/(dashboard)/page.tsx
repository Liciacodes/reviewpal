import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader, SectionLabel } from "@/components/PageHeader";
import { ReviewsList } from "@/components/ReviewsTable";
import { StatCards } from "@/components/StatCards";

export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Overview" description="AI reviews of your pull requests, and how useful they were." />

      <section aria-label="Stats">
        <StatCards />
      </section>

      <section aria-labelledby="recent-heading" className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <SectionLabel id="recent-heading">Recent reviews</SectionLabel>
          <Link
            href="/reviews"
            className="inline-flex items-center gap-1.5 text-sm text-accent transition-colors duration-150 hover:text-amber-300"
          >
            View all
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        <ReviewsList limit={8} />
      </section>
    </>
  );
}
