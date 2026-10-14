import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment';
import { withJobSignal } from '../jobs/job-context';
import { JobsService } from '../jobs/jobs.service';
import { Prisma } from '../../generated/prisma/client';

const REVISION_KEY = 'cache.public.revision';

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
      headers: { authorization: `Bearer ${secret}` },
      signal: withJobSignal(AbortSignal.timeout(3000)),
      redirect: 'error',
    });
    if (!response.ok)
      throw new Error(`Public cache revalidation returned ${response.status}`);
  }

  async revision(): Promise<{ revision: string }> {
    const record = await this.prisma.siteSetting.findUnique({
      where: { key: REVISION_KEY },
      select: { value: true },
    });
    if (!record) return { revision: 'initial' };
    if (typeof record.value !== 'string') {
      throw new Error('Invalid public cache revision');
    }
    return { revision: record.value };
  }

  async invalidate(): Promise<void> {
    const changeKey = randomUUID();
    const revision = randomUUID();
    await this.prisma.$transaction((transaction) =>
      this.writeInvalidation(transaction, changeKey, revision),
    );
    try {
      await this.deliver({ revision });
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
  ): Promise<void> {
    await this.writeInvalidation(transaction, changeKey, randomUUID());
  }

  private async writeInvalidation(
    transaction: Prisma.TransactionClient,
    changeKey: string,
    revision: string,
  ): Promise<void> {
    await transaction.siteSetting.upsert({
      where: { key: REVISION_KEY },
      create: { key: REVISION_KEY, value: revision },
      update: { value: revision },
    });
    const uniqueKey = `public-cache:${changeKey}`;
    await transaction.job.upsert({
      where: { uniqueKey },
      update: {},
      create: {
        payload: { revision },
        type: PUBLIC_CACHE_JOB,
        uniqueKey,
      },
    });
  }
}
