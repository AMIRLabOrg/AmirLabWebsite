import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { JobContext } from '../jobs/job-context';
import {
  DeferredJobError,
  JobLeaseLostError,
  JobsService,
} from '../jobs/jobs.service';
import { PublicCacheService } from '../public-cache/public-cache.service';
import {
  OpenAlexClient,
  OpenAlexRequestError,
  normalizeAuthorId,
} from './openalex-client';
import { RankingsService } from './rankings.service';
import { OpenAlexImporter } from './openalex-importer';
const JOB = 'SYNC_OPENALEX_AUTHOR';
const DAY = 86_400_000;

@Injectable()
export class OpenAlexService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpenAlexService.name);
  private timer?: NodeJS.Timeout;
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: OpenAlexClient,
    private readonly jobs: JobsService,
    private readonly rankings: RankingsService,
    private readonly publicCache: PublicCacheService,
  ) {}
  onModuleInit() {
    this.jobs.register(JOB, async (payload, context) => {
      if (
        !payload ||
        typeof payload !== 'object' ||
        Array.isArray(payload) ||
        typeof payload.personId !== 'string' ||
        typeof payload.version !== 'number' ||
        !Number.isInteger(payload.version)
      )
        throw new Error('Invalid OpenAlex job');
      await this.sync(payload.personId, payload.version, context);
    });
    this.jobs.registerCancelHandler(JOB, async (payload) => {
      const personId =
        payload &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        typeof payload.personId === 'string'
          ? payload.personId
          : null;
      const version =
        payload &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        typeof payload.version === 'number'
          ? payload.version
          : null;
      if (!personId || version === null) return;
      await this.prisma.openAlexProfile.updateMany({
        where: { personId, bindingVersion: version },
        data: {
          status: 'IDLE',
          attemptedAt: null,
          nextAttemptAt: new Date(Date.now() + DAY),
        },
      });
    });
    void this.scheduleDue();
    this.timer = setInterval(() => void this.scheduleDue(), 60 * 60_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async applyAuthorId(
    personId: string,
    value: string | null | undefined,
    db: Prisma.TransactionClient,
  ) {
    if (value === undefined) return false;
    const authorId = value === null ? null : normalizeAuthorId(value);
    // The person row exists even during the first binding; FK key-share locks remain compatible.
    await db.$queryRaw`SELECT "id" FROM "Person" WHERE "id" = ${personId}::uuid FOR NO KEY UPDATE`;
    await db.$queryRaw`SELECT "personId" FROM "OpenAlexProfile" WHERE "personId" = ${personId}::uuid FOR UPDATE`;
    const current = await db.openAlexProfile.findUnique({
      where: { personId },
    });
    if ((current?.authorId ?? null) === authorId) return;
    const duplicate = authorId
      ? await db.openAlexProfile.findUnique({ where: { authorId } })
      : null;
    if (duplicate && duplicate.personId !== personId)
      throw new ConflictException(
        'This OpenAlex author is already linked to another profile.',
      );
    await db.personResearchItem.updateMany({
      where: { personId, isCurrent: true },
      data: { isCurrent: false },
    });
    // Legacy contributor ownership is detached during the additive migration.
    await db.researchContributor.updateMany({
      where: { personId },
      data: { personId: null },
    });
    await db.contributorMatch.deleteMany({ where: { personId } });
    const nextVersion = (current?.bindingVersion ?? 0) + 1;
    const data = {
      authorId,
      status: authorId ? ('QUEUED' as const) : ('IDLE' as const),
      attemptedAt: null,
      syncedAt: null,
      citationCount: null,
      failureCount: 0,
      failureReason: null,
      nextAttemptAt: authorId ? new Date() : null,
      boundAt: authorId ? new Date() : null,
      summary: Prisma.JsonNull,
    };
    try {
      await db.openAlexProfile.upsert({
        where: { personId },
        create: { personId, bindingVersion: nextVersion, ...data },
        update: { ...data, bindingVersion: nextVersion },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'This OpenAlex author is already linked to another profile.',
        );
      throw error;
    }
    if (authorId) {
      const uniqueKey = `openalex:${personId}:${nextVersion}`;
      await db.job.upsert({
        where: { uniqueKey },
        update: {},
        create: {
          payload: { personId, version: nextVersion },
          type: JOB,
          uniqueKey,
        },
      });
    }
    await this.rankings.recalculateMany([personId], undefined, db);
    await this.publicCache.invalidateInTransaction(
      db,
      `openalex-binding:${personId}:${nextVersion}`,
    );
    return true;
  }
  async afterProfileChange(personIds: string[]) {
    await this.scheduleDue(personIds);
  }
  async scheduleDue(personIds?: string[]) {
    try {
      const profiles = await this.prisma.openAlexProfile.findMany({
        where: {
          ...(personIds ? { personId: { in: personIds } } : {}),
          authorId: { not: null },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        },
      });
      for (const profile of profiles)
        await this.jobs.enqueueWhileActive(
          JOB,
          { personId: profile.personId, version: profile.bindingVersion },
          `openalex:${profile.personId}:${profile.bindingVersion}`,
        );
    } catch {
      this.logger.warn('OpenAlex scheduling unavailable; retrying next hour.');
    }
  }
  async sync(personId: string, version: number, context: JobContext) {
    const profile = await this.prisma.openAlexProfile.findUnique({
      where: { personId },
    });
    if (!profile?.authorId || profile.bindingVersion !== version) return;
    if (
      profile.status === 'FAILED' &&
      profile.nextAttemptAt &&
      profile.nextAttemptAt > new Date()
    ) {
      throw new DeferredJobError(
        profile.failureReason ?? 'OpenAlex sync is waiting for its retry time.',
        profile.nextAttemptAt,
      );
    }
    await this.prisma.openAlexProfile.updateMany({
      where: { personId, bindingVersion: version },
      data: { status: 'RUNNING', attemptedAt: new Date() },
    });
    try {
      const [sequence] = await this.prisma.$queryRaw<
        Array<{ version: bigint }>
      >`SELECT nextval('"OpenAlexObservationSequence"')::bigint AS version`;
      if (!sequence) throw new Error('OpenAlex observation sequence missing');
      const snapshot = await this.client.fetchAuthorWorks(profile.authorId);
      const citationCount = await this.client.fetchAuthorCitationCount(
        profile.authorId,
      );
      await this.prisma.$transaction(
        async (db) => {
          await db.$queryRaw`SELECT "personId" FROM "OpenAlexProfile" WHERE "personId" = ${personId}::uuid FOR UPDATE`;
          const current = await db.openAlexProfile.findUnique({
            where: { personId },
          });
          if (!current?.authorId || current.bindingVersion !== version)
            return null;
          await this.jobs.assertActiveJob(db, context);
          const result = await new OpenAlexImporter(db).apply(
            current,
            snapshot,
            sequence.version,
          );
          await db.openAlexProfile.update({
            where: { personId },
            data: {
              status: 'SUCCEEDED',
              syncedAt: new Date(),
              citationCount,
              nextAttemptAt: new Date(Date.now() + DAY),
              failureCount: 0,
              failureReason: null,
              summary: result.summary,
            },
          });
          await this.rankings.recalculateMany(
            [personId, ...result.personIds],
            undefined,
            db,
          );
          if (result.changedOutputIds.length)
            await this.publicCache.invalidateInTransaction(
              db,
              `openalex:${context.jobId}`,
            );
          await this.jobs.completeJob(db, context);
          return result;
        },
        { timeout: 60_000 },
      );
    } catch (error) {
      if (
        error instanceof JobLeaseLostError ||
        context.signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      )
        throw error;
      const failures = profile.failureCount + 1;
      const wait = Math.max(
        Math.min(7 * DAY, 60_000 * 2 ** Math.min(failures, 14)),
        error instanceof OpenAlexRequestError ? error.retryAfterMs : 60_000,
      );
      const retryAt = new Date(Date.now() + wait);
      await this.prisma.openAlexProfile.updateMany({
        where: { personId, bindingVersion: version },
        data: {
          status: 'FAILED',
          failureCount: failures,
          failureReason:
            error instanceof OpenAlexRequestError
              ? error.message
              : 'OpenAlex sync failed; retry later.',
          nextAttemptAt: retryAt,
        },
      });
      // Profile backoff prevents the job runner from retrying a quota failure immediately.
      this.logger.warn('OpenAlex sync failed; profile backoff recorded.');
      throw new DeferredJobError(
        error instanceof OpenAlexRequestError
          ? error.message
          : 'OpenAlex sync failed; retry later.',
        retryAt,
      );
    }
  }
}
