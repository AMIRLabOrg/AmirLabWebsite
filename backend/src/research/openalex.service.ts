import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import {
  OpenAlexClient,
  OpenAlexRequestError,
  normalizeAuthorId,
} from './openalex-client';
import { RankingsService } from './rankings.service';
import {
  isOutputSection,
  ResearchProfileSyncService,
} from './research-profile-sync.service';
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
    private readonly profileSync: ResearchProfileSyncService,
  ) {}
  onModuleInit() {
    this.jobs.register(JOB, async (payload) => {
      if (
        !payload ||
        typeof payload !== 'object' ||
        Array.isArray(payload) ||
        typeof payload.personId !== 'string' ||
        typeof payload.version !== 'number' ||
        !Number.isInteger(payload.version)
      )
        throw new Error('Invalid OpenAlex job');
      await this.sync(payload.personId, payload.version);
    });
    void this.scheduleDue();
    this.timer = setInterval(() => void this.scheduleDue(), 60 * 60_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async applyLinks(
    personId: string,
    links: readonly { type: string; url: string }[],
    db: Prisma.TransactionClient,
  ) {
    const link = links.find((link) => link.type === 'OPENALEX');
    const authorId = link ? normalizeAuthorId(link.url) : null;
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
    // The profile link is authoritative: replacement drops old outputs immediately.
    const outputs = await db.researchItem.findMany({
      where: {
        type: { in: ['PAPER', 'DATASET'] },
        OR: [
          { contributors: { some: { personId } } },
          { submittedBy: { person: { id: personId } } },
          { contributors: { some: { matches: { some: { personId } } } } },
          ...(current?.authorId
            ? [
                {
                  openAlexWorkId: { not: null },
                  contributors: {
                    some: { openAlexAuthorId: current.authorId },
                  },
                },
              ]
            : []),
        ],
      },
      select: { id: true },
    });
    const ids = outputs.map(({ id }) => id);
    await db.researchItem.updateMany({
      where: { id: { in: ids } },
      data: {
        automationVersion: { increment: 1 },
        automationState: 'IDLE',
        automationOwner: null,
        automationClaimedAt: null,
      },
    });
    await db.researchItem.updateMany({
      where: { id: { in: ids }, submittedBy: { person: { id: personId } } },
      data: { submittedById: null },
    });
    await db.researchContributor.updateMany({
      where: { personId, researchItemId: { in: ids } },
      data: { personId: null },
    });
    await db.contributorMatch.deleteMany({
      where: {
        personId,
        contributor: { researchItem: { type: { in: ['PAPER', 'DATASET'] } } },
      },
    });
    const sections = await db.personProfileSection.findMany({
      where: { personId },
      select: { id: true, type: true, title: true },
    });
    await db.personProfileSection.deleteMany({
      where: {
        id: {
          in: sections
            .filter(({ type, title }) =>
              isOutputSection(type, title, 'DATASET'),
            )
            .map(({ id }) => id),
        },
      },
    });
    const unshared = await db.researchItem.findMany({
      where: {
        id: { in: ids },
        contributors: {
          none: {
            OR: [
              { personId: { not: null } },
              { matches: { some: { personId: { not: personId } } } },
            ],
          },
        },
        OR: [
          { submittedById: null },
          { submittedBy: { person: { id: personId } } },
        ],
      },
      select: { id: true },
    });
    const removeIds = unshared.map(({ id }) => id);
    if (removeIds.length) {
      await db.weeklyReportOutput.deleteMany({
        where: { outputId: { in: removeIds } },
      });
      await db.researchProgramItem.deleteMany({
        where: { researchItemId: { in: removeIds } },
      });
      await db.researchItem.deleteMany({ where: { id: { in: removeIds } } });
    }
    const data = {
      authorId,
      status: authorId ? ('QUEUED' as const) : ('IDLE' as const),
      attemptedAt: null,
      syncedAt: null,
      failureCount: 0,
      failureReason: null,
      nextAttemptAt: authorId ? new Date() : null,
      summary: Prisma.JsonNull,
    };
    try {
      await db.openAlexProfile.upsert({
        where: { personId },
        create: { personId, bindingVersion: 1, ...data },
        update: { ...data, bindingVersion: { increment: 1 } },
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
    return true;
  }
  async afterProfileChange(personIds: string[]) {
    await this.rankings.recalculateMany(personIds);
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
  async sync(personId: string, version: number) {
    const profile = await this.prisma.openAlexProfile.findUnique({
      where: { personId },
    });
    if (
      !profile?.authorId ||
      profile.bindingVersion !== version ||
      (profile.status === 'FAILED' &&
        profile.nextAttemptAt &&
        profile.nextAttemptAt > new Date())
    )
      return;
    await this.prisma.openAlexProfile.updateMany({
      where: { personId, bindingVersion: version },
      data: { status: 'RUNNING', attemptedAt: new Date() },
    });
    try {
      const works = await this.client.fetchAuthorWorks(profile.authorId);
      const result = await this.prisma.$transaction(
        async (db) => {
          await db.$queryRaw`SELECT "personId" FROM "OpenAlexProfile" WHERE "personId" = ${personId}::uuid FOR UPDATE`;
          const current = await db.openAlexProfile.findUnique({
            where: { personId },
          });
          if (!current?.authorId || current.bindingVersion !== version)
            return null;
          const result = await new OpenAlexImporter(db).apply(current, works);
          await db.openAlexProfile.update({
            where: { personId },
            data: {
              status: 'SUCCEEDED',
              syncedAt: new Date(),
              nextAttemptAt: new Date(Date.now() + DAY),
              failureCount: 0,
              failureReason: null,
              summary: result.summary,
            },
          });
          await this.profileSync.normalizePublishedOutputs(
            result.outputIds,
            null,
            db,
          );
          return result;
        },
        { timeout: 60_000 },
      );
      if (result) await this.rankings.recalculateMany(result.personIds);
    } catch (error) {
      const failures = profile.failureCount + 1;
      const wait = Math.max(
        Math.min(7 * DAY, 60_000 * 2 ** Math.min(failures, 14)),
        error instanceof OpenAlexRequestError ? error.retryAfterMs : 60_000,
      );
      await this.prisma.openAlexProfile.updateMany({
        where: { personId, bindingVersion: version },
        data: {
          status: 'FAILED',
          failureCount: failures,
          failureReason:
            error instanceof OpenAlexRequestError
              ? error.message
              : 'OpenAlex sync failed; retry later.',
          nextAttemptAt: new Date(Date.now() + wait),
        },
      });
      // Profile backoff prevents the job runner from retrying a quota failure immediately.
      this.logger.warn('OpenAlex sync failed; profile backoff recorded.');
    }
  }
}
