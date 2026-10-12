import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { ConfigService } from '@nestjs/config';
import { BackupsService } from '../src/backups/backups.service';
import {
  type Environment,
  validateEnvironment,
} from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { hashPassword } from '../src/auth/password';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl, 'Set DATABASE_URL explicitly; .env is never loaded.');
  const target = new URL(databaseUrl);
  assert(
    ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname),
    'Only loopback PostgreSQL is allowed.',
  );
  assert(
    target.pathname === '/amirl_backup_verification',
    'Only the dedicated amirl_backup_verification database can be cleared.',
  );
  const root = await mkdtemp(join(tmpdir(), 'amirlab-local-verification-'));
  const uploads = join(root, 'uploads');
  const directory = join(root, 'backups');
  await mkdir(uploads);
  const config = new ConfigService<Environment, true>(
    validateEnvironment({
      DATABASE_URL: databaseUrl,
      FRONTEND_ORIGINS: 'http://127.0.0.1:3000',
      NODE_ENV: 'test',
      STORAGE_PROVIDER: 'local',
      UPLOAD_ROOT: uploads,
    }),
  );
  const prisma = new PrismaService(config);
  try {
    const password = randomBytes(24).toString('base64url');
    const passwordHash = await hashPassword(password);
    for (const role of ['ADMIN', 'MEMBER'] as const) {
      await prisma.user.upsert({
        where: { email: `${role.toLowerCase()}@local.amirlab.test` },
        create: {
          email: `${role.toLowerCase()}@local.amirlab.test`,
          role,
          status: 'ACTIVE',
          passwordHash,
          person: {
            create: {
              slug: `local-${role.toLowerCase()}`,
              fullName: `Local ${role}`,
              expertise: [],
            },
          },
        },
        update: { passwordHash, status: 'ACTIVE' },
      });
    }
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6y1kAAAAASUVORK5CYII=',
      'base64',
    );
    await writeFile(join(uploads, 'verification.png'), bytes);
    const asset = await prisma.asset.upsert({
      where: { storageKey: 'verification.png' },
      create: {
        access: 'PUBLIC',
        kind: 'SITE_IMAGE',
        originalName: 'verification.png',
        mimeType: 'image/png',
        storageKey: 'verification.png',
        byteSize: bytes.length,
        checksum: createHash('sha256').update(bytes).digest('hex'),
      },
      update: {},
    });
    await writeFile(
      join(root, 'browser-fixtures.json'),
      JSON.stringify({ password, assetId: asset.id }),
      { mode: 0o600 },
    );
    const backup = new BackupsService(config, prisma);
    await backup.configure({ directory, enabled: true, intervalMinutes: 1 });
    const snapshot = await backup.capture();
    const baseline = {
      users: await prisma.user.findMany({ orderBy: { id: 'asc' } }),
      people: await prisma.person.findMany({ orderBy: { id: 'asc' } }),
      assets: await prisma.asset.findMany({ orderBy: { id: 'asc' } }),
      settings: await prisma.siteSetting.findMany({ orderBy: { key: 'asc' } }),
    };
    const count = async () =>
      (await readdir(directory)).filter((entry) => !entry.startsWith('.'))
        .length;
    await backup.runScheduled();
    assert.equal(await count(), 1, 'A fresh backup must not run again early.');
    await backup.runScheduled(new Date(Date.now() + 62_000));
    assert.equal(
      await count(),
      2,
      'A due schedule must capture a real archive.',
    );
    await backup.configure({ directory, enabled: false, intervalMinutes: 1 });
    await backup.runScheduled(new Date(Date.now() + 120_000));
    assert.equal(
      await count(),
      2,
      'A disabled schedule must not create backups.',
    );
    const dump = join(directory, snapshot.id, 'database.dump');
    const original = await readFile(dump);
    await writeFile(dump, 'corrupt archive');
    assert.equal(
      (await backup.status()).backups.find((entry) => entry.id === snapshot.id)
        ?.verified,
      false,
    );
    await assert.rejects(backup.restore(snapshot.id), /verification/);
    assert.deepEqual(
      await prisma.user.findMany({ orderBy: { id: 'asc' } }),
      baseline.users,
    );
    assert.deepEqual(await readFile(join(uploads, 'verification.png')), bytes);
    await writeFile(dump, original);
    // Fault injection exercises the real upload swap and rollback, not a service mock.
    const faultBin = join(root, 'fault-bin');
    await mkdir(faultBin);
    await writeFile(
      join(faultBin, 'pg_restore'),
      '#!/bin/sh\nfor arg in "$@"; do if [ "$arg" = "--dbname" ]; then exit 1; fi; done\nexec /usr/bin/pg_restore "$@"\n',
      { mode: 0o700 },
    );
    const oldPath = process.env.PATH;
    const changedBytes = Buffer.from('uploads before a failed restore');
    await writeFile(join(uploads, 'verification.png'), changedBytes);
    process.env.PATH = `${faultBin}:${oldPath}`;
    try {
      await assert.rejects(
        backup.restore(snapshot.id),
        /PostgreSQL backup operation failed/,
      );
      assert.deepEqual(
        await readFile(join(uploads, 'verification.png')),
        changedBytes,
      );
      assert.deepEqual(
        await prisma.user.findMany({ orderBy: { id: 'asc' } }),
        baseline.users,
      );
      await assert.rejects(readFile(`${uploads}.restore-pending.json`));
      const interrupted = JSON.stringify({
        safetyBackupId: snapshot.id,
        directory,
      });
      await writeFile(`${uploads}.restore-pending.json`, interrupted);
      await assert.rejects(
        backup.restore(snapshot.id, directory),
        /PostgreSQL backup operation failed/,
      );
      assert.equal(
        await readFile(`${uploads}.restore-pending.json`, 'utf8'),
        interrupted,
        'Failed recovery must preserve the previous interruption marker.',
      );
    } finally {
      process.env.PATH = oldPath;
    }
    await writeFile(join(uploads, 'verification.png'), bytes);
    await writeFile(`${uploads}.restore-pending.json`, '{"safetyBackupId":');
    await assert.rejects(backup.onModuleInit(), /Interrupted local restore/);
    await assert.rejects(backup.capture(), /Interrupted local restore/);
    await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE');
    await prisma.$executeRawUnsafe('CREATE SCHEMA public');
    await assert.rejects(
      prisma.user.count(),
      'The application query must fail while the schema is cleared.',
    );
    await rm(join(uploads, 'verification.png'));
    await writeFile(
      join(uploads, 'unwanted-after-clear.txt'),
      'must disappear',
    );
    const execute = promisify(execFile);
    const { stdout } = await execute(
      process.execPath,
      [
        resolve('node_modules/tsx/dist/cli.mjs'),
        resolve('scripts/restore-local-backup.ts'),
        directory,
        snapshot.id,
        uploads,
        '--replace-local-data',
      ],
      { env: { ...process.env, DATABASE_URL: databaseUrl }, timeout: 300_000 },
    );
    const restored = JSON.parse(stdout) as {
      restored: boolean;
      safetyBackupId: string;
    };
    assert.equal(restored.restored, true);
    await assert.rejects(readFile(`${uploads}.restore-pending.json`));
    assert.deepEqual(
      await prisma.user.findMany({ orderBy: { id: 'asc' } }),
      baseline.users,
    );
    assert.deepEqual(
      await prisma.person.findMany({ orderBy: { id: 'asc' } }),
      baseline.people,
    );
    assert.deepEqual(
      await prisma.asset.findMany({ orderBy: { id: 'asc' } }),
      baseline.assets,
    );
    assert.deepEqual(
      await prisma.siteSetting.findMany({ orderBy: { key: 'asc' } }),
      baseline.settings,
    );
    assert.deepEqual(await readFile(join(uploads, 'verification.png')), bytes);
    await assert.rejects(readFile(join(uploads, 'unwanted-after-clear.txt')));
    const restoredBackup = new BackupsService(config, prisma);
    assert.notEqual(
      (await restoredBackup.status()).lastBackup?.id,
      restored.safetyBackupId,
      'Safety snapshots must not become the default regular backup.',
    );
    await restoredBackup.configure({
      directory,
      enabled: false,
      intervalMinutes: 1,
    });
    const report = {
      target: {
        host: target.hostname,
        port: target.port,
        database: 'amirl_backup_verification',
      },
      root,
      uploads,
      directory,
      snapshotId: snapshot.id,
      safetyBackupId: restored.safetyBackupId,
      checks: [
        'manual capture',
        'schedule due',
        'schedule not due',
        'schedule disabled',
        'corrupt archive rejected without changing data',
        'corrupt archive not reported verified',
        'failed database restore rolls uploads back',
        'failed interrupted recovery preserves its marker',
        'interrupted restore blocks API startup and capture',
        'recovery clears interruption marker',
        'explicit recovery accepts truncated interruption markers',
        'safety snapshots are excluded from default backup selection',
        'application query fails after clearing schema',
        'recovery CLI works with no settings or auth tables',
        'users restored exactly',
        'people restored exactly',
        'assets restored exactly',
        'settings restored exactly',
        'upload bytes restored exactly',
        'extra uploads removed',
      ],
      users: baseline.users.length,
      assets: baseline.assets.length,
    };
    await writeFile(join(root, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Local backup verification failed.',
  );
  process.exitCode = 1;
});
