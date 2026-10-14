import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

type QueryResult = { rows: Array<Record<string, unknown>> };
type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
};

const { Client } = createRequire(__filename)('pg') as {
  Client: new (options: { connectionString: string }) => PgClient;
};

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL must select an amirl_sqa_* local database',
  );
}
const target = new URL(databaseUrl);
if (
  target.hostname !== '127.0.0.1' ||
  target.port !== '5433' ||
  !target.pathname.slice(1).startsWith('amirl_sqa_')
) {
  throw new Error('TEST_DATABASE_URL must select 127.0.0.1:5433/amirl_sqa_*');
}

const client = new Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();
  await client.query('BEGIN');
  try {
    const userId = randomUUID();
    const personId = randomUUID();
    const outputId = randomUUID();
    const projectId = randomUUID();
    const reportId = randomUUID();

    await client.query(
      `INSERT INTO "User" (id, email, "updatedAt") VALUES ($1, $2, NOW())`,
      [userId, `${userId}@local.test`],
    );
    await client.query(
      `INSERT INTO "Person" (id, slug, "fullName", expertise, "updatedAt") VALUES ($1, $2, 'Fixture person', '{}', NOW())`,
      [personId, personId],
    );
    await client.query(
      `INSERT INTO "ResearchItem" (id, type, slug, "updatedAt") VALUES ($1, 'PAPER', $2, NOW()), ($3, 'PROJECT', $4, NOW())`,
      [outputId, outputId, projectId, projectId],
    );
    await client.query(`INSERT INTO "Paper" ("researchItemId") VALUES ($1)`, [
      outputId,
    ]);
    await client.query(`INSERT INTO "Project" ("researchItemId") VALUES ($1)`, [
      projectId,
    ]);
    await client.query(
      `INSERT INTO "PersonResearchItem" ("personId", "researchItemId", "authorId") VALUES ($1, $2, 'A1')`,
      [personId, outputId],
    );
    await client.query(
      `INSERT INTO "ProjectOutputReference" (id, "projectId", label, doi, "identityKey") VALUES ($1, $2, 'Fixture DOI', '10.1/fixture', 'doi:10.1/fixture')`,
      [randomUUID(), projectId],
    );
    await client.query(
      `INSERT INTO "WeeklyReport" (id, "weekStart", accomplishments, "nextWeekPlan", "authorId", "updatedAt") VALUES ($1, CURRENT_DATE, 'done', 'next', $2, NOW())`,
      [reportId, userId],
    );

    await client.query('SAVEPOINT output_delete');
    await assert.rejects(
      client.query(`DELETE FROM "ResearchItem" WHERE id = $1`, [outputId]),
      (error: unknown) => (error as { code?: string }).code === '23503',
      'retained association must block output deletion',
    );
    await client.query('ROLLBACK TO SAVEPOINT output_delete');

    await client.query('SAVEPOINT user_delete');
    await assert.rejects(
      client.query(`DELETE FROM "User" WHERE id = $1`, [userId]),
      (error: unknown) => (error as { code?: string }).code === '23503',
      'purge_cannot_delete_report_author',
    );
    await client.query('ROLLBACK TO SAVEPOINT user_delete');

    await client.query(`DELETE FROM "Person" WHERE id = $1`, [personId]);
    assert.equal(
      Number(
        (
          await client.query(
            `SELECT COUNT(*) FROM "PersonResearchItem" WHERE "researchItemId" = $1`,
            [outputId],
          )
        ).rows[0].count,
      ),
      0,
    );
    await client.query(`DELETE FROM "ResearchItem" WHERE id = $1`, [outputId]);
    assert.equal(
      Number(
        (
          await client.query(
            `SELECT COUNT(*) FROM "ProjectOutputReference" WHERE "projectId" = $1`,
            [projectId],
          )
        ).rows[0].count,
      ),
      1,
      'independent references survive catalogue deletion',
    );
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}

void main();
