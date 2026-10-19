BEGIN;

DO $$ BEGIN
  CREATE TYPE "FoundingMemberRole" AS ENUM ('FOUNDER', 'CO_FOUNDER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FoundingMember" (
  "personId" UUID NOT NULL,
  "role" "FoundingMemberRole" NOT NULL,
  CONSTRAINT "FoundingMember_pkey" PRIMARY KEY ("personId"),
  CONSTRAINT "FoundingMember_personId_fkey" FOREIGN KEY ("personId")
    REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "FoundingMember_single_founder"
  ON "FoundingMember"("role") WHERE "role" = 'FOUNDER';

ALTER TABLE "FoundingMember" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "SiteSetting" WHERE "key" = 'people.founding-members'
      AND (jsonb_typeof("value"->'cofounderIds') IS DISTINCT FROM 'array'
        OR NOT ("value" ? 'founderId')
        OR jsonb_typeof("value"->'founderId') NOT IN ('string', 'null'))
  ) THEN
    RAISE EXCEPTION 'Invalid founding-members selection: founderId must be a string or null and cofounderIds must be an array';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "SiteSetting" CROSS JOIN LATERAL jsonb_array_elements("value"->'cofounderIds') AS member(id)
      WHERE "key" = 'people.founding-members' AND jsonb_typeof(member.id) <> 'string'
  ) THEN
    RAISE EXCEPTION 'Invalid co-founder ID in saved selection';
  END IF;
  PERFORM ("value"->>'founderId')::uuid FROM "SiteSetting" WHERE "key" = 'people.founding-members';
  PERFORM member.id::uuid FROM "SiteSetting"
    CROSS JOIN LATERAL jsonb_array_elements_text("value"->'cofounderIds') AS member(id)
    WHERE "key" = 'people.founding-members';
END $$;

WITH legacy AS (
  SELECT "value" FROM "SiteSetting" WHERE "key" = 'people.founding-members'
), candidates AS (
  SELECT "value"->>'founderId' AS "personId", 'FOUNDER'::"FoundingMemberRole" AS "role"
    FROM legacy
  UNION ALL
  SELECT cofounder.id, 'CO_FOUNDER'::"FoundingMemberRole"
    FROM legacy
    CROSS JOIN LATERAL jsonb_array_elements_text("value"->'cofounderIds') AS cofounder(id)
    WHERE cofounder.id::uuid IS DISTINCT FROM ("value"->>'founderId')::uuid
)
INSERT INTO "FoundingMember" ("personId", "role")
  SELECT DISTINCT person."id", candidates."role"
    FROM candidates JOIN "Person" AS person ON person."id" = candidates."personId"::uuid
  ON CONFLICT ("personId") DO NOTHING;

-- Preserve the original selection as a backup; application reads use FoundingMember.
UPDATE "SiteSetting" SET "key" = 'migrated.people.founding-members.20261019'
  WHERE "key" = 'people.founding-members';

COMMIT;
