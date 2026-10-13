import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment';
import { JobsService } from '../jobs/jobs.service';

const REVISION_KEY = 'cache.public.revision';

export const PUBLIC_CACHE_JOB = 'REVALIDATE_PUBLIC_CACHE';
const PUBLIC_JOBS = new Set([
  'DISCOVER_RESEARCH_SOURCE',
  'SYNC_SCHOLAR_PROFILE',
  'SYNC_OPENALEX_AUTHOR',
  'RECALCULATE_ALL_RANKS',
  'PURGE_DELETED_USERS',
]);

@Injectable()
export class PublicCacheService implements OnModuleInit {
  private readonly logger = new Logger(PublicCacheService.name);

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly jobs: JobsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(PUBLIC_CACHE_JOB, () => this.deliver());
    this.jobs.onSettled(async (type) => {
      if (PUBLIC_JOBS.has(type)) await this.invalidate();
    });
  }

  private async deliver(): Promise<void> {
    // Shared by every backend using this DB, including deployments without a webhook.
    const revision = randomUUID();
    await this.prisma.siteSetting.upsert({
      where: { key: REVISION_KEY },
      create: { key: REVISION_KEY, value: revision },
      update: { value: revision },
    });
    const secret = this.config.get('publicCacheRevalidationSecret', {
      infer: true,
    });
    if (!secret) return;
    const frontend = this.config.get('frontendOrigins', { infer: true })[0];
    const url = new URL('/api/revalidate', frontend).toString();
    const response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(3000),
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
    try {
      // Try immediately even when discovery jobs occupy the durable worker.
      await this.deliver();
    } catch (error) {
      this.logger.warn(
        `Public cache delivery deferred: ${error instanceof Error ? error.message : String(error)}`,
      );
      try {
        await this.jobs.enqueue(PUBLIC_CACHE_JOB, {});
      } catch (queueError) {
        // Delivery failure cannot turn an already committed editor save into a failure.
        this.logger.error(
          `Unable to enqueue public cache revalidation: ${queueError instanceof Error ? queueError.message : String(queueError)}`,
        );
      }
    }
  }
}
