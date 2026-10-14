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
    const actorId = randomUUID();
    const projectId = randomUUID();
    const outputId = randomUUID();
    const programId = randomUUID();
    await client.query(
      `INSERT INTO "User" (id, email, "updatedAt") VALUES ($1, $2, NOW())`,
      [actorId, `${actorId}@local.test`],
    );
    await client.query(
      `INSERT INTO "ResearchItem" (id, type, slug, "updatedAt") VALUES ($1::uuid, 'PROJECT', $1::text, NOW()), ($2::uuid, 'PAPER', $2::text, NOW())`,
      [projectId, outputId],
    );
    await client.query(`INSERT INTO "Project" ("researchItemId") VALUES ($1)`, [
      projectId,
    ]);
    await client.query(`INSERT INTO "Paper" ("researchItemId") VALUES ($1)`, [
      outputId,
    ]);
    await client.query(
      `INSERT INTO "ResearchProgram" (id, slug, name, objective, "createdById", "updatedAt") VALUES ($1::uuid, $1::text, 'Fixture', 'Fixture objective', $2, NOW())`,
      [programId, actorId],
    );
    await client.query(
      `INSERT INTO "ResearchProgramItem" ("programId", "researchItemId") VALUES ($1, $2)`,
      [programId, projectId],
    );
    await client.query(
      `INSERT INTO "ProjectOutputReference" (id, "projectId", label, doi, "identityKey") VALUES ($1, $2, 'Independent paper', '10.1/example', 'doi:10.1/example')`,
      [randomUUID(), projectId],
    );
    await client.query(
      `INSERT INTO "ResearchProgramOutputReference" (id, "programId", label, url, "identityKey") VALUES ($1, $2, 'Independent dataset', 'https://example.org/data', 'url:https://example.org/data')`,
      [randomUUID(), programId],
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
      'catalogue_delete_preserves_reference',
    );
    await client.query(
      `DELETE FROM "ResearchProgramOutputReference" WHERE "programId" = $1`,
      [programId],
    );
    assert.equal(
      Number(
        (
          await client.query(
            `SELECT COUNT(*) FROM "ResearchProgramItem" WHERE "programId" = $1 AND "researchItemId" = $2`,
            [programId, projectId],
          )
        ).rows[0].count,
      ),
      1,
      'program_project_links_survive',
    );
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}

void main();
