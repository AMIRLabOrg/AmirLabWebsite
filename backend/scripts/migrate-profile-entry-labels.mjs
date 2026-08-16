import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const client = new Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'PersonProfileSubsection'
          AND column_name = 'entries'
      ) AS "hasLegacyEntries"
    `);

    if (!rows[0]?.hasLegacyEntries) {
      console.log('Profile entry schema is already current or the profile tables do not exist yet.');
      return;
    }

    await client.query('BEGIN');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "PersonProfileEntry" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "label" TEXT,
        "content" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL,
        "subsectionId" UUID NOT NULL,
        CONSTRAINT "PersonProfileEntry_pkey" PRIMARY KEY ("id")
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "PersonProfileEntry_subsectionId_sortOrder_key"
      ON "PersonProfileEntry"("subsectionId", "sortOrder")
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'PersonProfileEntry_subsectionId_fkey'
        ) THEN
          ALTER TABLE "PersonProfileEntry"
          ADD CONSTRAINT "PersonProfileEntry_subsectionId_fkey"
          FOREIGN KEY ("subsectionId") REFERENCES "PersonProfileSubsection"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    await client.query(`
      INSERT INTO "PersonProfileEntry" (
        "id", "label", "content", "sortOrder", "subsectionId"
      )
      SELECT
        gen_random_uuid(),
        NULL,
        legacy_entry.content,
        legacy_entry.ordinality - 1,
        subsection."id"
      FROM "PersonProfileSubsection" AS subsection
      CROSS JOIN LATERAL unnest(subsection."entries")
        WITH ORDINALITY AS legacy_entry(content, ordinality)
      WHERE NOT EXISTS (
        SELECT 1
        FROM "PersonProfileEntry" AS existing
        WHERE existing."subsectionId" = subsection."id"
      )
    `);
    await client.query('ALTER TABLE "PersonProfileSubsection" DROP COLUMN "entries"');
    await client.query('COMMIT');
    console.log('Migrated profile subsection string entries to labeled profile entry records.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

await main();
