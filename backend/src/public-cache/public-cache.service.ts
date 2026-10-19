import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment';
import { withJobSignal } from '../jobs/job-context';
import { JobsService } from '../jobs/jobs.service';
import { Prisma } from '../../generated/prisma/client';

const REVISION_KEY = 'cache.public.revision';
export const PUBLIC_CACHE_SCOPES = [
  'content',
  'home',
  'about',
  'people',
  'research',
  'departments',
  'universities',
  'positions',
] as const;
export type PublicCacheScope = (typeof PUBLIC_CACHE_SCOPES)[number];

export const PUBLIC_CACHE_JOB = 'REVALIDATE_PUBLIC_CACHE';
@Injectable()
export class PublicCacheService implements OnModuleInit {
  private readonly logger = new Logger(PublicCacheService.name);

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly jobs: JobsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(PUBLIC_CACHE_JOB, (payload) => this.deliver(payload));
  }

  private async deliver(payload: Prisma.JsonValue): Promise<void> {
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      typeof payload.revision !== 'string'
    )
      throw new Error('Invalid public cache delivery job');
    const secret = this.config.get('publicCacheRevalidationSecret', {
      infer: true,
    });
    if (!secret) return;
    const frontend = this.config.get('frontendOrigins', { infer: true })[0];
    const url = new URL('/api/revalidate', frontend).toString();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: withJobSignal(AbortSignal.timeout(3000)),
      redirect: 'error',
    });
    if (!response.ok)
      throw new Error(`Public cache revalidation returned ${response.status}`);
  }

  async revision() {
    const records = await this.prisma.siteSetting.findMany({
      where: {
        key: {
          in: [
            REVISION_KEY,
            ...PUBLIC_CACHE_SCOPES.map((scope) => `${REVISION_KEY}.${scope}`),
          ],
        },
      },
      select: { key: true, value: true },
    });
    const values = new Map<string, string>();
    for (const record of records) {
      if (typeof record.value !== 'string')
        throw new Error('Invalid public cache revision');
      values.set(record.key, record.value);
    }
    const revision = values.get(REVISION_KEY) ?? 'initial';
    const scopes = Object.fromEntries(
      PUBLIC_CACHE_SCOPES.map((scope) => [
        scope,
        values.get(`${REVISION_KEY}.${scope}`) ??
          (scope === 'content' ? revision : 'initial'),
      ]),
    );
    return { revision, scopes };
  }

  async invalidate(
    scopes: readonly PublicCacheScope[] = ['content'],
  ): Promise<void> {
    const changeKey = randomUUID();
    const revision = randomUUID();
    await this.prisma.$transaction((transaction) =>
      this.writeInvalidation(transaction, changeKey, revision, scopes),
    );
    try {
      await this.deliver({ revision, scopes: [...scopes] });
      await this.prisma.job.deleteMany({
        where: {
          status: 'PENDING',
          uniqueKey: `public-cache:${changeKey}`,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Public cache delivery deferred: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async invalidateInTransaction(
    transaction: Prisma.TransactionClient,
    changeKey: string,
    scopes: readonly PublicCacheScope[] = ['research', 'people'],
  ): Promise<void> {
    await this.writeInvalidation(transaction, changeKey, randomUUID(), scopes);
  }

  private async writeInvalidation(
    transaction: Prisma.TransactionClient,
    changeKey: string,
    revision: string,
    scopes: readonly PublicCacheScope[],
  ): Promise<void> {
    // Keep a stable full-cache generation alongside the legacy revision.
    await transaction.siteSetting.upsert({
      where: { key: `${REVISION_KEY}.content` },
      create: { key: `${REVISION_KEY}.content`, value: 'initial' },
      update: {},
    });
    await transaction.siteSetting.upsert({
      where: { key: REVISION_KEY },
      create: { key: REVISION_KEY, value: revision },
      update: { value: revision },
    });
    for (const scope of [...new Set(scopes)].sort()) {
      const key = `${REVISION_KEY}.${scope}`;
      await transaction.siteSetting.upsert({
        where: { key },
        create: { key, value: revision },
        update: { value: revision },
      });
    }
    const uniqueKey = `public-cache:${changeKey}`;
    await transaction.job.upsert({
      where: { uniqueKey },
      update: {},
      create: {
        payload: { revision, scopes: [...scopes] },
        type: PUBLIC_CACHE_JOB,
        uniqueKey,
      },
    });
  }
}
