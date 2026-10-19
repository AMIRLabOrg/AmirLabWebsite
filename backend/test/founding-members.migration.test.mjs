import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { migrateFoundingMembers } from '../scripts/migrate-founding-members.mjs';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (
  !databaseUrl ||
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname)
) {
  throw new Error(
    'TEST_DATABASE_URL must explicitly select a local PostgreSQL database',
  );
}

async function fixture(run) {
  const client = new pg.Client({ connectionString: databaseUrl });
  const schema = `founding_test_${randomUUID().replaceAll('-', '')}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`CREATE TABLE "Person" (id UUID PRIMARY KEY, "roleTitle" TEXT);
      CREATE TABLE "SiteSetting" (key TEXT PRIMARY KEY, value JSONB)`);
    await run(client);
  } finally {
    await client.query('ROLLBACK');
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  }
}

const founder = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const cofounder = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const other = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const missing = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

test('migrates saved selections, enforces membership constraints, and preserves later edits on reruns', async () => {
  await fixture(async (client) => {
    await client.query(
      `INSERT INTO "Person" VALUES ($1, 'Advisor'), ($2, 'Researcher'), ($3, 'Director')`,
      [founder, cofounder, other],
    );
    await client.query(
      `INSERT INTO "SiteSetting" VALUES ('people.founding-members', $1), ('unrelated', '{}')`,
      [
        JSON.stringify({
          founderId: founder,
          cofounderIds: [
            cofounder.toUpperCase(),
            cofounder,
            founder.toUpperCase(),
            missing,
          ],
        }),
      ],
    );
    await migrateFoundingMembers(client);
    assert.deepEqual(
      (await client.query(`SELECT * FROM "FoundingMember" ORDER BY "personId"`))
        .rows,
      [
        { personId: founder, role: 'FOUNDER' },
        { personId: cofounder, role: 'CO_FOUNDER' },
      ],
    );
    assert.deepEqual(
      (
        await client.query(`SELECT "roleTitle" FROM "Person" WHERE id = $1`, [
          founder,
        ])
      ).rows,
      [{ roleTitle: 'Advisor' }],
    );
    assert.deepEqual(
      (await client.query(`SELECT key FROM "SiteSetting" ORDER BY key`)).rows,
      [
        { key: 'migrated.people.founding-members.20261019' },
        { key: 'unrelated' },
      ],
    );
    await assert.rejects(
      client.query(`INSERT INTO "FoundingMember" VALUES ($1, 'FOUNDER')`, [
        other,
      ]),
      (error) => error.code === '23505',
    );
    await assert.rejects(
      client.query(`INSERT INTO "FoundingMember" VALUES ($1, 'CO_FOUNDER')`, [
        founder,
      ]),
      (error) => error.code === '23505',
    );
    await assert.rejects(
      client.query(`INSERT INTO "FoundingMember" VALUES ($1, 'CO_FOUNDER')`, [
        missing,
      ]),
      (error) => error.code === '23503',
    );
    await client.query(
      `INSERT INTO "FoundingMember" VALUES ($1, 'CO_FOUNDER')`,
      [other],
    );
    await migrateFoundingMembers(client);
    assert.equal(
      (await client.query(`SELECT * FROM "FoundingMember"`)).rows.length,
      3,
    );
    await client.query(`DELETE FROM "Person" WHERE id = $1`, [founder]);
    assert.equal(
      (await client.query(`SELECT * FROM "FoundingMember"`)).rows.length,
      2,
    );
  });
});

test('rolls back schema and data changes when the saved selection cannot be migrated', async () => {
  await fixture(async (client) => {
    await client.query(
      `INSERT INTO "SiteSetting" VALUES ('people.founding-members', '{"cofounderIds": "invalid"}')`,
    );
    await assert.rejects(migrateFoundingMembers(client), /array/);
    assert.equal(
      (await client.query(`SELECT to_regclass('"FoundingMember"') AS name`))
        .rows[0].name,
      null,
    );
    assert.equal(
      (await client.query(`SELECT * FROM "SiteSetting"`)).rows.length,
      1,
    );
  });
});
