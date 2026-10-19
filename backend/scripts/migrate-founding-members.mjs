import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

export async function migrateFoundingMembers(client) {
  const sql = await readFile(
    new URL(
      '../prisma/migrations/20261019000000_founding_members/migration.sql',
      import.meta.url,
    ),
    'utf8',
  );
  try {
    await client.query(sql);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await migrateFoundingMembers(client);
    console.log('Founding-member schema and saved selections migrated.');
  } finally {
    await client.end();
  }
}
