-- Reviewable targeted upgrade. Do not run while the old backend is serving traffic.
-- Preserves people, accounts, settings, papers, projects, reports and mounted files.
-- Removes only the nine retired Scholar metric columns and their index.
-- OpenAlex associations are intentionally established by each person's next full sync.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
DO $$
BEGIN
  IF (SELECT count(*) FROM "User") <> 117 OR
     (SELECT count(*) FROM "Person") <> 117 OR
     (SELECT count(*) FROM "ResearchItem" WHERE type = 'PAPER') <> 564 OR
     (SELECT count(*) FROM "OpenAlexProfile") <> 58 THEN
    RAISE EXCEPTION 'Hosted counts changed since preflight; inspect before migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "ProjectOutput") OR
     EXISTS (SELECT 1 FROM "WeeklyReportOutput") OR
     EXISTS (SELECT 1 FROM "ResearchProgramItem") OR
     EXISTS (SELECT 1 FROM "ProjectUpdate" WHERE "linkedOutputId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Legacy references now exist; preserve them before migration';
  END IF;
END $$;

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'CANCELLED';

-- DropForeignKey
ALTER TABLE "WeeklyReport" DROP CONSTRAINT "WeeklyReport_authorId_fkey";

-- DropIndex
DROP INDEX "PersonMetric_scholarNextAttemptAt_idx";

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3),
ADD COLUMN     "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN     "leaseToken" UUID;

-- AlterTable
ALTER TABLE "OpenAlexProfile" ADD COLUMN     "boundAt" TIMESTAMP(3),
ADD COLUMN     "citationCount" INTEGER;

-- AlterTable
ALTER TABLE "PersonMetric" DROP COLUMN "scholarAttemptedAt",
DROP COLUMN "scholarCitationCount",
DROP COLUMN "scholarFailureCount",
DROP COLUMN "scholarFailureReason",
DROP COLUMN "scholarNextAttemptAt",
DROP COLUMN "scholarStatus",
DROP COLUMN "scholarSyncedAt",
DROP COLUMN "scholarUrl",
DROP COLUMN "scholarUserId";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "closingNote" TEXT;

-- AlterTable
ALTER TABLE "ResearchSourceSnapshot" ADD COLUMN     "observationVersion" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PersonResearchItem" (
    "personId" UUID NOT NULL,
    "researchItemId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missingSince" TIMESTAMP(3),

    CONSTRAINT "PersonResearchItem_pkey" PRIMARY KEY ("personId","researchItemId")
);

-- CreateTable
CREATE TABLE "ProjectOutputReference" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "doi" TEXT,
    "url" TEXT,
    "identityKey" TEXT NOT NULL,
    "legacyReferenceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectOutputReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchProgramOutputReference" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "doi" TEXT,
    "url" TEXT,
    "identityKey" TEXT NOT NULL,
    "legacyReferenceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchProgramOutputReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonResearchItem_researchItemId_isCurrent_idx" ON "PersonResearchItem"("researchItemId", "isCurrent");

-- CreateIndex
CREATE INDEX "PersonResearchItem_personId_isCurrent_idx" ON "PersonResearchItem"("personId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectOutputReference_projectId_identityKey_key" ON "ProjectOutputReference"("projectId", "identityKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectOutputReference_projectId_legacyReferenceKey_key" ON "ProjectOutputReference"("projectId", "legacyReferenceKey");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchProgramOutputReference_programId_identityKey_key" ON "ResearchProgramOutputReference"("programId", "identityKey");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchProgramOutputReference_programId_legacyReferenceKey_key" ON "ResearchProgramOutputReference"("programId", "legacyReferenceKey");

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonResearchItem" ADD CONSTRAINT "PersonResearchItem_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonResearchItem" ADD CONSTRAINT "PersonResearchItem_researchItemId_fkey" FOREIGN KEY ("researchItemId") REFERENCES "ResearchItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOutputReference" ADD CONSTRAINT "ProjectOutputReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("researchItemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProgramOutputReference" ADD CONSTRAINT "ResearchProgramOutputReference_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ResearchProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma schema diff does not include this PostgreSQL sequence.
CREATE SEQUENCE IF NOT EXISTS "OpenAlexObservationSequence";

-- Existing binding dates were not recorded. Establish a migration-time health baseline
-- and make every bound person eligible for their own full-author sync immediately.
UPDATE "OpenAlexProfile"
SET "boundAt" = CURRENT_TIMESTAMP,
    "nextAttemptAt" = CURRENT_TIMESTAMP
WHERE "authorId" IS NOT NULL;
COMMIT;
