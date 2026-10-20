-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "githubReviewId" TEXT,
ADD COLUMN     "postError" TEXT,
ADD COLUMN     "postedAt" TIMESTAMP(3);
