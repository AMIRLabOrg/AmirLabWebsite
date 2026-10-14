CREATE SEQUENCE "OpenAlexObservationSequence";

ALTER TABLE "ResearchSourceSnapshot"
  ADD COLUMN "observationVersion" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "Job"
  ADD COLUMN "leaseToken" UUID,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

ALTER TABLE "OpenAlexProfile" ADD COLUMN "boundAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "closingNote" TEXT;

ALTER TABLE "WeeklyReport" DROP CONSTRAINT "WeeklyReport_authorId_fkey";
ALTER TABLE "WeeklyReport"
  ADD CONSTRAINT "WeeklyReport_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PersonResearchItem" (
  "personId" UUID NOT NULL,
  "researchItemId" UUID NOT NULL,
  "authorId" TEXT NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "missingSince" TIMESTAMP(3),
  CONSTRAINT "PersonResearchItem_pkey" PRIMARY KEY ("personId", "researchItemId")
);

CREATE INDEX "PersonResearchItem_researchItemId_isCurrent_idx"
  ON "PersonResearchItem"("researchItemId", "isCurrent");
CREATE INDEX "PersonResearchItem_personId_isCurrent_idx"
  ON "PersonResearchItem"("personId", "isCurrent");
ALTER TABLE "PersonResearchItem"
  ADD CONSTRAINT "PersonResearchItem_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonResearchItem"
  ADD CONSTRAINT "PersonResearchItem_researchItemId_fkey"
  FOREIGN KEY ("researchItemId") REFERENCES "ResearchItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
CREATE UNIQUE INDEX "ProjectOutputReference_projectId_identityKey_key"
  ON "ProjectOutputReference"("projectId", "identityKey");
CREATE UNIQUE INDEX "ProjectOutputReference_projectId_legacyReferenceKey_key"
  ON "ProjectOutputReference"("projectId", "legacyReferenceKey");
ALTER TABLE "ProjectOutputReference"
  ADD CONSTRAINT "ProjectOutputReference_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("researchItemId") ON DELETE CASCADE ON UPDATE CASCADE;

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
CREATE UNIQUE INDEX "ResearchProgramOutputReference_programId_identityKey_key"
  ON "ResearchProgramOutputReference"("programId", "identityKey");
CREATE UNIQUE INDEX "ResearchProgramOutputReference_programId_legacyReferenceKey_key"
  ON "ResearchProgramOutputReference"("programId", "legacyReferenceKey");
ALTER TABLE "ResearchProgramOutputReference"
  ADD CONSTRAINT "ResearchProgramOutputReference_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "ResearchProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
