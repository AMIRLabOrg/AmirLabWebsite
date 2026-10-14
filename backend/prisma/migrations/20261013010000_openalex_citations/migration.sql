-- Scholar totals are not transferable to OpenAlex; the next author sync fills this field.
ALTER TABLE "OpenAlexProfile" ADD COLUMN "citationCount" INTEGER;
ALTER TABLE "PersonMetric"
  DROP COLUMN "scholarCitationCount",
  DROP COLUMN "scholarStatus",
  DROP COLUMN "scholarUrl",
  DROP COLUMN "scholarUserId",
  DROP COLUMN "scholarFailureReason",
  DROP COLUMN "scholarSyncedAt",
  DROP COLUMN "scholarAttemptedAt",
  DROP COLUMN "scholarNextAttemptAt",
  DROP COLUMN "scholarFailureCount";
