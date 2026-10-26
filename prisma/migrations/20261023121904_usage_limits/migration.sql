-- AlterEnum
ALTER TYPE "ReviewStatus" ADD VALUE 'skipped';

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "skipReason" TEXT;

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "installationId" INTEGER NOT NULL,
    "reviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrNotice" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_installationId_createdAt_idx" ON "AiUsage"("installationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrNotice_repoId_prNumber_kind_key" ON "PrNotice"("repoId", "prNumber", "kind");

-- CreateIndex
CREATE INDEX "Repo_installationId_idx" ON "Repo"("installationId");

-- AddForeignKey
ALTER TABLE "PrNotice" ADD CONSTRAINT "PrNotice_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
