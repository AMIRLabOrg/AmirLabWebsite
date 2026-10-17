import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const recoveryEnv = {
  ...process.env,
  NODE_ENV: 'production',
  DATABASE_URL: '',
};
delete recoveryEnv.NODE_TEST_CONTEXT;
const args = [
  '--import',
  'tsx',
  'scripts/restore-local-backup.ts',
  '/tmp/unused-backups',
  'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  '/tmp/unused-uploads',
  '--replace-data',
];

test('recovery refuses to start without acknowledging stopped services', () => {
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env: recoveryEnv,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--services-stopped/);
});

test('offline recovery requires an explicit target instead of loading .env', () => {
  const result = spawnSync(process.execPath, [...args, '--services-stopped'], {
    encoding: 'utf8',
    env: recoveryEnv,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Set DATABASE_URL explicitly/);
});
