import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../generated/prisma/client';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { MailSettingsService } from './mail-settings.service';

describe('MailSettingsService', () => {
  let root: string;
  const request = jest.spyOn(globalThis, 'fetch');
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'mail-settings-'));
    request.mockReset().mockResolvedValue(
      Response.json({
        emails: {
          daily: {
            used: 2,
            limit: 100,
            resets_at: '2026-10-14T00:00:00.000Z',
          },
        },
      }),
    );
  });
  afterAll(() => request.mockRestore());
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('stores Resend credentials encrypted and never returns them', async () => {
    let row: { value: unknown } | null = null;
    const transaction = {
      siteSetting: {
        upsert: jest.fn(
          ({
            create,
            update,
          }: {
            create: { value: unknown };
            update: { value: unknown };
          }) => {
            row = { value: row ? update.value : create.value };
            return Promise.resolve(row);
          },
        ),
      },
      auditRecord: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      siteSetting: { findUnique: jest.fn(() => Promise.resolve(row)) },
      auditRecord: {
        create: transaction.auditRecord.create,
        count: jest.fn().mockResolvedValue(0),
      },
      job: { count: jest.fn().mockResolvedValue(0) },
      $transaction: (run: (db: typeof transaction) => Promise<unknown>) =>
        run(transaction),
    };
    const service = new MailSettingsService(
      prisma as unknown as PrismaService,
      {
        get: (key: string) =>
          key === 'encryptionKey'
            ? 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
            : undefined,
      } as unknown as ConfigService<Environment, true>,
    );

    const status = await service.save(
      {
        provider: 'RESEND',
        from: 'AMIR Lab <mail@amirlab.org>',
        secret: 're_private_credential',
      },
      'admin',
    );

    expect(JSON.stringify(row)).not.toContain('re_private_credential');
    expect(JSON.stringify(status)).not.toContain('re_private_credential');
    expect(status).toMatchObject({
      configured: true,
      provider: 'RESEND',
      source: 'admin',
    });

    const cleared = await service.save(
      {
        provider: 'RESEND',
        from: 'AMIR Lab <mail@amirlab.org>',
        clearSecret: true,
      },
      'admin',
    );
    expect(cleared).toMatchObject({ configured: false, hasSecret: false });
    expect(JSON.stringify(row)).not.toContain('re_private_credential');
  });

  it('counts only SMTP success and failure audit events', async () => {
    const queries: Prisma.AuditRecordCountArgs[] = [];
    const count = jest.fn((query: Prisma.AuditRecordCountArgs) => {
      queries.push(query);
      return Promise.resolve(queries.length === 1 ? 4 : 1);
    });
    const service = new MailSettingsService(
      {
        siteSetting: {
          findUnique: jest.fn().mockResolvedValue({
            value: {
              provider: 'SMTP',
              from: 'mail@amirlab.org',
              host: 'smtp.example.org',
              port: 587,
              credentials: null,
            },
          }),
        },
        auditRecord: { count },
      } as unknown as PrismaService,
      { get: () => undefined } as unknown as ConfigService<Environment, true>,
    );

    await expect(service.usage()).resolves.toMatchObject({
      provider: 'SMTP',
      sent: 4,
      failed: 1,
    });
    expect(count).toHaveBeenCalledTimes(2);
    expect(queries).toHaveLength(2);
    expect(queries[0]?.where?.details).toEqual({
      path: ['provider'],
      equals: 'SMTP',
    });
    expect(queries[1]?.where?.details).toEqual({
      path: ['provider'],
      equals: 'SMTP',
    });
  });

  it('does not replace SMTP settings when connection verification fails', async () => {
    const upsert = jest.fn();
    const service = new MailSettingsService(
      {
        siteSetting: { findUnique: jest.fn().mockResolvedValue(null), upsert },
        $transaction: jest.fn(),
      } as unknown as PrismaService,
      {
        get: (key: string) =>
          key === 'encryptionKey'
            ? 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
            : undefined,
      } as unknown as ConfigService<Environment, true>,
    );
    // A rejected SMTP connection is tested through a local invalid port, without network access.
    await expect(
      service.save(
        {
          provider: 'SMTP',
          from: 'mail@amirlab.org',
          host: '127.0.0.1',
          port: 1,
        },
        'admin',
      ),
    ).rejects.toThrow('SMTP verification failed');
    expect(upsert).not.toHaveBeenCalled();
  });
});
