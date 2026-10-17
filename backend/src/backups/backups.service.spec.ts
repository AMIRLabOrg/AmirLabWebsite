import { ConfigService } from '@nestjs/config';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { BackupsService } from './backups.service';
import { resolveService } from '../../test/resolve-service';

describe('Local backup settings and archive validation', () => {
  let root: string;
  const settings = new Map<string, unknown>();
  const prisma = {
    siteSetting: {
      findUnique: jest.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(
          settings.has(where.key) ? { value: settings.get(where.key) } : null,
        ),
      ),
      upsert: jest.fn(
        ({
          where,
          create,
        }: {
          where: { key: string };
          create: { value: unknown };
        }) => {
          settings.set(where.key, create.value);
          return Promise.resolve();
        },
      ),
    },
  };
  async function service(
    databaseUrl = 'postgresql://user@127.0.0.1:5433/test',
    nodeEnv = 'test',
    storageProvider = 'local',
  ) {
    const values: Record<string, unknown> = {
      databaseUrl,
      nodeEnv,
      storageProvider,
      uploadRoot: join(root, 'uploads'),
      encryptionKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    };
    return resolveService(BackupsService, [
      { provide: PrismaService, useValue: prisma },
      {
        provide: ConfigService,
        useValue: { get: (key: string) => values[key] },
      },
    ]);
  }
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'amirlab-backup-unit-'));
    settings.clear();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('persists settings without a redeploy and supports disabling the schedule', async () => {
    const backup = await service();
    await backup.configure({
      directory: join(root, 'backups'),
      enabled: true,
      intervalMinutes: 60,
    });
    expect((await backup.status()).settings).toEqual({
      provider: 'local',
      directory: join(root, 'backups'),
      enabled: true,
      intervalMinutes: 60,
    });
    await backup.configure({
      directory: join(root, 'backups'),
      enabled: false,
      intervalMinutes: 60,
    });
    expect((await backup.status()).settings?.enabled).toBe(false);
  });

  it('enables production settings and scheduling with a remote PostgreSQL source', async () => {
    const backup = await service(
      'postgresql://user@database.internal:5432/live?sslmode=require',
      'production',
    );
    await backup.configure({
      directory: join(root, 'backups'),
      enabled: true,
      intervalMinutes: 60,
    });
    expect(await backup.status()).toMatchObject({
      canBackup: true,
      canRestore: false,
      restoreRequiresOffline: true,
      reason: null,
      settings: { enabled: true },
    });
    const capture = jest.spyOn(backup, 'capture').mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      createdAt: '',
      verified: true,
    });
    await backup.runScheduled();
    expect(capture).toHaveBeenCalledWith('scheduled');
    await expect(
      backup.restore('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
    ).rejects.toThrow('Stop all API instances and workers');
  });

  it.each([
    ['https://database.internal/live', 'local'],
    ['postgresql://user@database.internal/live', 's3'],
  ])('refuses unsupported backup sources (%s, %s)', async (url, provider) => {
    const backup = await service(url, 'production', provider);
    expect(await backup.status()).toMatchObject({
      canBackup: false,
      reason: 'UNSUPPORTED_SOURCE',
    });
    await expect(
      backup.configure({
        directory: join(root, 'backups'),
        enabled: false,
        intervalMinutes: 60,
      }),
    ).rejects.toThrow('PostgreSQL and local uploads');
  });

  it.each([
    ['sslmode=verify-full', 'verify-full'],
    ['ssl=true', 'verify-full'],
    ['ssl=1', 'verify-full'],
    ['ssl=false', 'verify-full'],
    ['ssl=0', 'verify-full'],
    ['', 'verify-full'],
    ['sslmode=disable', 'disable'],
    ['ssl=false&sslmode=verify-full', 'verify-full'],
  ])(
    'passes TLS settings (%s) without exposing passwords in arguments',
    async (query, mode) => {
      const backup = await service(
        `postgresql://user:p%40ss@database.internal:5432/live?${query}&sslrootcert=%2Fprivate%2Fca.pem&sslnegotiation=direct`,
        'production',
      );
      const bin = join(root, 'bin');
      await mkdir(bin);
      await writeFile(
        join(bin, 'pg_dump'),
        `#!/usr/bin/env node
const fs = require('node:fs');
const assert = require('node:assert/strict');
assert.equal(process.env.PGSSLMODE, '${mode}');
assert.equal(process.env.PGSSLNEGOTIATION, 'direct');
assert.equal(process.env.PGSSLROOTCERT, '/private/ca.pem');
assert.equal(process.env.PGHOST, 'database.internal');
assert.equal(process.env.PGDATABASE, 'live');
assert.equal(process.env.PGPASSWORD, 'p@ss');
assert(!process.argv.join(' ').includes('p@ss'));
fs.writeFileSync(process.argv[process.argv.indexOf('--file') + 1], 'test archive');
`,
        { mode: 0o700 },
      );
      await writeFile(join(bin, 'pg_restore'), '#!/bin/sh\nexit 0\n', {
        mode: 0o700,
      });
      const oldPath = process.env.PATH;
      process.env.PATH = `${bin}:${oldPath}`;
      try {
        await backup.configure({
          directory: join(root, 'backups'),
          enabled: false,
          intervalMinutes: 60,
        });
        const snapshot = await backup.capture();
        expect(
          await readFile(
            join(root, 'backups', snapshot.id, 'database.dump'),
            'utf8',
          ),
        ).toBe('test archive');
        expect(await backup.status()).toMatchObject({
          canBackup: true,
          canRestore: false,
        });
        await expect(backup.restore(snapshot.id)).rejects.toThrow(
          'Stop all API instances and workers',
        );
        await expect(
          backup.restore(snapshot.id, join(root, 'backups'), undefined, true),
        ).resolves.toMatchObject({ restored: true });
      } finally {
        process.env.PATH = oldPath;
      }
    },
  );

  it('refuses backup storage inside uploads', async () => {
    const backup = await service();
    await expect(
      backup.configure({
        directory: join(root, 'uploads', 'backups'),
        enabled: false,
        intervalMinutes: 60,
      }),
    ).rejects.toThrow('overlap');
  });

  it('rejects a corrupted snapshot before changing database or uploads', async () => {
    const backup = await service();
    await backup.configure({
      directory: join(root, 'backups'),
      enabled: false,
      intervalMinutes: 60,
    });
    const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    const folder = join(root, 'backups', id);
    await mkdir(folder);
    await writeFile(
      join(folder, 'manifest.json'),
      JSON.stringify({
        version: 1,
        id,
        createdAt: new Date().toISOString(),
        database: 'test',
        files: { 'database.dump': 'wrong' },
      }),
    );
    await writeFile(join(folder, 'database.dump'), 'corrupt');
    expect((await backup.status()).lastBackup).toBeNull();
    expect((await backup.status()).canRestore).toBe(false);
    await expect(backup.restore(id)).rejects.toThrow('verification');
    expect(await readFile(join(folder, 'database.dump'), 'utf8')).toBe(
      'corrupt',
    );
  });
  it('blocks API startup after an interrupted restore until recovery is completed', async () => {
    const backup = await service();
    await writeFile(
      join(root, 'uploads.restore-pending.json'),
      JSON.stringify({ safetyBackupId: 'test-backup' }),
    );
    try {
      await expect((async () => backup.onModuleInit())()).rejects.toThrow(
        'Interrupted local restore',
      );
    } finally {
      backup.onModuleDestroy();
    }
  });
});

describe('Remote backup settings', () => {
  it('redacts credentials, preserves blanks, and schedules from unchecked complete manifests', async () => {
    const { S3BackupStorage } = await import('./s3-backup-storage.js');
    const list = jest
      .spyOn(S3BackupStorage.prototype, 'list')
      .mockResolvedValue([
        {
          version: 1,
          id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
          createdAt: '2026-10-12T00:00:00Z',
          database: 'test',
          files: { 'database.dump': 'a'.repeat(64) },
        },
      ]);
    const root = await mkdtemp(join(tmpdir(), 'backup-remote-settings-'));
    let value: unknown;
    const prisma = {
      siteSetting: {
        findUnique: () => Promise.resolve(value ? { value } : null),
        upsert: ({ create }: { create: { value: unknown } }) => {
          value = create.value;
          return Promise.resolve();
        },
      },
    };
    const config = new ConfigService({
      databaseUrl: 'postgresql://user@127.0.0.1/test',
      nodeEnv: 'test',
      storageProvider: 'local',
      uploadRoot: join(root, 'uploads'),
      encryptionKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    });
    const backup = await resolveService(BackupsService, [
      { provide: ConfigService, useValue: config },
      { provide: PrismaService, useValue: prisma },
    ]);
    try {
      const input = {
        provider: 's3' as const,
        bucket: 'bucket',
        region: 'us-east-1',
        prefix: '',
        forcePathStyle: false,
        enabled: true,
        intervalMinutes: 60,
        accessKeyId: 'sample-id',
        secretAccessKey: 'sample-secret',
      };
      await backup.configure(input);
      expect(JSON.stringify(value)).not.toContain('sample-secret');
      await backup.configure({
        ...input,
        accessKeyId: '',
        secretAccessKey: '',
      });
      const status = await backup.status();
      expect(JSON.stringify(status)).not.toContain('sample-secret');
      expect(status.backups[0].verified).toBeNull();
      expect(status.lastBackup?.id).toBe(
        'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      );
      const capture = jest.spyOn(backup, 'capture').mockResolvedValue({
        id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        createdAt: '',
        verified: true,
      });
      await backup.runScheduled(new Date('2026-10-12T00:30:00Z'));
      expect(capture).not.toHaveBeenCalled();
      await backup.runScheduled(new Date('2026-10-12T01:00:00Z'));
      expect(capture).toHaveBeenCalledWith('scheduled');
      value = { ...status.settings, credentials: null };
      expect((await backup.status()).reason).toBe('STORAGE_UNAVAILABLE');
      await expect(backup.configure(input)).resolves.toMatchObject({
        configured: true,
      });
      list.mockRejectedValue(new Error('private error'));
      expect((await backup.status()).reason).toBe('STORAGE_UNAVAILABLE');
    } finally {
      list.mockRestore();
      await rm(root, { recursive: true, force: true });
    }
  });
});
it('preserves a truncated marker when the first upload rename fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'backup-swap-failure-'));
  const uploads = join(root, 'uploads');
  const marker = `${uploads}.restore-pending.json`;
  const raw = '{"truncated":';
  await writeFile(marker, raw);
  const config = new ConfigService({
    databaseUrl: 'postgresql://user@127.0.0.1/test',
    nodeEnv: 'test',
    storageProvider: 'local',
    uploadRoot: uploads,
  });
  const backup = await resolveService(BackupsService, [
    { provide: ConfigService, useValue: config },
    { provide: PrismaService, useValue: {} },
  ]);
  // A vanished live upload directory reproduces the first-rename failure without touching a database.
  const internals = backup as unknown as {
    verifySnapshot: () => Promise<void>;
    snapshot: () => Promise<{ id: string }>;
    storage: () => Promise<{
      load: (id: string, folder: string) => Promise<unknown>;
    }>;
  };
  jest.spyOn(internals, 'verifySnapshot').mockResolvedValue();
  jest.spyOn(internals, 'snapshot').mockImplementation(async () => {
    await rm(uploads, { recursive: true, force: true });
    return { id: 'safety' };
  });
  jest.spyOn(internals, 'storage').mockResolvedValue({
    load: async (id, folder) => {
      await mkdir(join(folder, 'uploads'));
      return { id, database: 'test' };
    },
  });
  try {
    await expect(
      backup.restore(
        'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        join(root, 'backups'),
      ),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(marker, 'utf8')).toBe(raw);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
