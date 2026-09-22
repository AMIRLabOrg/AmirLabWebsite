import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL is required');

const client = new Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Person'
          AND column_name = 'publicEmail'
      ) AS "hasPublicEmail"
    `);
    if (!rows[0]?.hasPublicEmail) {
      console.log('Single-email migration is already applied.');
      return;
    }

    await client.query('BEGIN');
    await client.query(`
      UPDATE "User" AS account
      SET "email" = person."publicEmail"
      FROM "Person" AS person
      WHERE person."userId" = account."id"
        AND account."email" IS NULL
        AND person."publicEmail" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "User" AS existing
          WHERE existing."email" = person."publicEmail"
            AND existing."id" <> account."id"
        )
    `);
    const { rows: orphanRows } = await client.query(`
      SELECT COUNT(*)::int AS "count"
      FROM "Person" AS person
      LEFT JOIN "User" AS account ON account."id" = person."userId"
      WHERE person."publicEmail" IS NOT NULL
        AND account."id" IS NULL
    `);
    if (orphanRows[0]?.count > 0) {
      throw new Error(
        `Cannot remove legacy profile emails: ${orphanRows[0].count} profile email(s) have no account email.`,
      );
    }
    const { rowCount } = await client.query(`
      UPDATE "Person"
      SET "publicEmail" = NULL
      WHERE "publicEmail" IS NOT NULL
    `);
    await client.query(`
      UPDATE "ProfileEditRequest"
      SET "payload" = "payload" - 'publicEmail' - 'email'
      WHERE "payload" ? 'publicEmail' OR "payload" ? 'email'
    `);
    await client.query('COMMIT');
    console.log(`Copied account emails and cleared ${rowCount ?? 0} legacy profile email(s).`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

await main();
