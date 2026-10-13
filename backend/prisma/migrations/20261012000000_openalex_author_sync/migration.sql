-- CreateEnum
CREATE TYPE "OpenAlexSyncStatus" AS ENUM ('IDLE', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- AlterEnum
ALTER TYPE "PersonLinkType" ADD VALUE 'OPENALEX';

-- AlterTable
ALTER TABLE "ResearchItem" ADD COLUMN     "openAlexWorkId" TEXT;

-- AlterTable
ALTER TABLE "ResearchContributor" ADD COLUMN     "openAlexAuthorId" TEXT;

-- CreateTable
CREATE TABLE "OpenAlexProfile" (
    "personId" UUID NOT NULL,
    "authorId" TEXT,
    "bindingVersion" INTEGER NOT NULL DEFAULT 0,
    "status" "OpenAlexSyncStatus" NOT NULL DEFAULT 'IDLE',
    "attemptedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenAlexProfile_pkey" PRIMARY KEY ("personId")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpenAlexProfile_authorId_key" ON "OpenAlexProfile"("authorId");

-- CreateIndex
CREATE INDEX "OpenAlexProfile_nextAttemptAt_status_idx" ON "OpenAlexProfile"("nextAttemptAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchItem_openAlexWorkId_key" ON "ResearchItem"("openAlexWorkId");

-- AddForeignKey
ALTER TABLE "OpenAlexProfile" ADD CONSTRAINT "OpenAlexProfile_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

