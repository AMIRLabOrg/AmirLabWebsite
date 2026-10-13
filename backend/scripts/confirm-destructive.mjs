#!/usr/bin/env node
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[db] DATABASE_URL is required.');
  process.exit(1);
}

let target;
try {
  const parsed = new URL(databaseUrl);
  target = `${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`;
} catch {
  console.error('[db] DATABASE_URL is invalid.');
  process.exit(1);
}

const bypass =
  process.argv.includes('--yes') ||
  /^(1|true|yes)$/i.test(process.env.DB_REBUILD_CONFIRM ?? '');

if (bypass) {
  console.log(
    `[db] Proceeding with destructive rebuild of ${target} (confirmation bypassed).`,
  );
  process.exit(0);
}

console.log(
  `[db] WARNING: db:rebuild deletes ALL data in ${target} and reseeds from seed/amirl-site.json.`,
);

if (!process.stdin.isTTY) {
  console.error(
    '[db] No interactive terminal. Re-run with `-- --yes` or DB_REBUILD_CONFIRM=yes to confirm.',
  );
  process.exit(1);
}

const readline = createInterface({ input: process.stdin, output: process.stdout });
const answer = await readline.question('Type "rebuild" to continue: ');
readline.close();

if (answer.trim().toLowerCase() !== 'rebuild') {
  console.error('[db] Aborted. No changes were made.');
  process.exit(1);
}

console.log('[db] Confirmed.');
