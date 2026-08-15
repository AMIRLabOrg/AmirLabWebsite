import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as cheerio from 'cheerio';
import {
  NotificationType,
  PersonLinkType,
  Prisma,
  ReviewStatus,
  SourceFetchStatus,
} from '../../generated/prisma/client';
import {
  RECALCULATE_ALL_RANKS_JOB,
  SYNC_SCHOLAR_PROFILE_JOB,
} from '../jobs/job-types';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SettingsService,
  earnedRank,
  effectiveRank,
} from '../settings/settings.service';
import { PrismaService } from '../database/prisma.service';
import {
  SafeSourceFetcher,
  SourceUnavailableError,
} from './safe-source-fetcher';

const DAY = 86_400_000;
const MAX_BACKOFF = 7 * DAY;

@Injectable()
export class RankingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RankingsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly fetcher: SafeSourceFetcher,
    private readonly jobs: JobsService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(SYNC_SCHOLAR_PROFILE_JOB, async (payload) => {
      const personId = recordString(payload, 'personId');
      await this.syncScholar(personId);
    });
    this.jobs.register(RECALCULATE_ALL_RANKS_JOB, async () => {
      await this.recalculateAll();
    });
    void this.scheduleDueScholarProfiles();
    this.timer = setInterval(
      () => void this.scheduleDueScholarProfiles(),
      60 * 60_000,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async recalculate(personId: string, actorId?: string): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: { metrics: true },
    });
    if (!person) return;
    const paperCount = await this.prisma.researchItem.count({
      where: {
        contributors: { some: { personId } },
        reviewStatus: ReviewStatus.PUBLISHED,
        type: 'PAPER',
      },
    });
    const policy = await this.settings.ranking();
    const nextEarned = earnedRank(
      paperCount,
      person.metrics?.scholarCitationCount ?? null,
      policy,
    );
    const previousEffective = effectiveRank(
      person.appointedRank,
      person.earnedRank,
    );
    const nextEffective = effectiveRank(person.appointedRank, nextEarned);

    await this.prisma.$transaction([
      this.prisma.personMetric.upsert({
        where: { personId },
        create: { personId, publishedPaperCount: paperCount },
        update: { publishedPaperCount: paperCount },
      }),
      this.prisma.person.update({
        where: { id: personId },
        data: { earnedRank: nextEarned },
      }),
      this.prisma.auditRecord.create({
        data: {
          action: 'person.rank-recalculated',
          actorId,
          entityId: personId,
          entityType: 'Person',
          details: {
            appointedRank: person.appointedRank,
            citationCount: person.metrics?.scholarCitationCount ?? null,
            earnedRank: { from: person.earnedRank, to: nextEarned },
            paperCount,
          },
        },
      }),
    ]);
    if (person.userId && previousEffective !== nextEffective) {
      await this.notifications.create(person.userId, {
        type: NotificationType.RANK_CHANGED,
        title: 'Research rank updated',
        body: nextEffective
          ? `Your publication record now qualifies for ${nextEffective.replaceAll('_', ' ').toLowerCase()}.`
          : 'Your research rank was recalculated.',
        actionUrl: '/workspace/profile',
      });
    }
  }

  async recalculateMany(
    personIds: readonly string[],
    actorId?: string,
  ): Promise<void> {
    const ids = [...new Set(personIds)];
    if (!ids.length) return;
    const people = await this.prisma.person.findMany({
      where: { id: { in: ids } },
      include: { metrics: true },
    });
    if (!people.length) return;

    const countRows = await this.prisma.$queryRaw<
      Array<{ personId: string; paperCount: number }>
    >(
      Prisma.sql`
        SELECT
          contributor."personId" AS "personId",
          COUNT(DISTINCT contributor."researchItemId")::integer AS "paperCount"
        FROM "ResearchContributor" AS contributor
        INNER JOIN "ResearchItem" AS item
          ON item."id" = contributor."researchItemId"
        WHERE contributor."personId" IN (${Prisma.join(people.map(({ id }) => id))})
          AND item."reviewStatus" = 'PUBLISHED'::"ReviewStatus"
          AND item."type" = 'PAPER'::"ResearchItemType"
        GROUP BY contributor."personId"
      `,
    );
    const counts = new Map(
      countRows.map(({ paperCount, personId }) => [personId, paperCount]),
    );
    const policy = await this.settings.ranking();
    const changes = people.map((person) => {
      const paperCount = counts.get(person.id) ?? 0;
      const citationCount = person.metrics?.scholarCitationCount ?? null;
      const nextEarned = earnedRank(paperCount, citationCount, policy);
      return {
        citationCount,
        nextEarned,
        nextEffective: effectiveRank(person.appointedRank, nextEarned),
        paperCount,
        person,
        previousEffective: effectiveRank(person.appointedRank, person.earnedRank),
      };
    });

    await this.prisma.$transaction(async (transaction) => {
      const metricRows = changes.map(({ paperCount, person }) =>
        Prisma.sql`(${person.id}::uuid, ${paperCount}::integer, NOW(), NOW())`,
      );
      await transaction.$executeRaw(
        Prisma.sql`
          INSERT INTO "PersonMetric" (
            "personId",
            "publishedPaperCount",
            "createdAt",
            "updatedAt"
          )
          VALUES ${Prisma.join(metricRows)}
          ON CONFLICT ("personId") DO UPDATE
          SET
            "publishedPaperCount" = EXCLUDED."publishedPaperCount",
            "updatedAt" = NOW()
        `,
      );

      const rankRows = changes.map(({ nextEarned, person }) =>
        Prisma.sql`(${person.id}::uuid, ${nextEarned}::"AcademicRank")`,
      );
      await transaction.$executeRaw(
        Prisma.sql`
          UPDATE "Person" AS person
          SET
            "earnedRank" = selected.earned_rank,
            "updatedAt" = NOW()
          FROM (VALUES ${Prisma.join(rankRows)}) AS selected(person_id, earned_rank)
          WHERE person."id" = selected.person_id
        `,
      );

      await transaction.auditRecord.createMany({
        data: changes.map(({ citationCount, nextEarned, paperCount, person }) => ({
          action: 'person.rank-recalculated',
          actorId,
          entityId: person.id,
          entityType: 'Person',
          details: {
            appointedRank: person.appointedRank,
            bulk: true,
            citationCount,
            earnedRank: { from: person.earnedRank, to: nextEarned },
            paperCount,
          },
        })),
      });

    });

    await this.notifications.createMany(
      changes.flatMap(({ nextEffective, person, previousEffective }) =>
        person.userId && previousEffective !== nextEffective
          ? [
              {
                actionUrl: '/workspace/profile',
                body: nextEffective
                  ? `Your publication record now qualifies for ${nextEffective.replaceAll('_', ' ').toLowerCase()}.`
                  : 'Your research rank was recalculated.',
                payload: { personId: person.id },
                recipientId: person.userId,
                title: 'Research rank updated',
                type: NotificationType.RANK_CHANGED,
              },
            ]
          : [],
      ),
    );
  }

  async recalculateAll(): Promise<void> {
    const people = await this.prisma.person.findMany({ select: { id: true } });
    for (const { id } of people) await this.recalculate(id);
  }

  private async scheduleDueScholarProfiles(): Promise<void> {
    try {
      const now = new Date();
      const staleAt = new Date(now.getTime() - DAY);
      const people = await this.prisma.person.findMany({
        where: {
          isPublished: true,
          links: { some: { type: PersonLinkType.GOOGLE_SCHOLAR } },
          OR: [
            { metrics: null },
            { metrics: { scholarSyncedAt: null, scholarNextAttemptAt: null } },
            {
              metrics: {
                scholarSyncedAt: { lt: staleAt },
                scholarNextAttemptAt: { lte: now },
              },
            },
            {
              metrics: {
                scholarSyncedAt: { lt: staleAt },
                scholarNextAttemptAt: null,
              },
            },
          ],
        },
        select: { id: true },
        orderBy: { updatedAt: 'asc' },
      });
      for (const [index, person] of people.entries()) {
        await this.jobs.enqueueWhileActive(
          SYNC_SCHOLAR_PROFILE_JOB,
          { personId: person.id },
          `scholar-sync:${person.id}`,
          new Date(now.getTime() + index * 60_000),
        );
      }
    } catch (error) {
      this.logger.error(
        `Unable to schedule Scholar profiles: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async syncScholar(personId: string): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: {
        metrics: true,
        links: {
          where: { type: PersonLinkType.GOOGLE_SCHOLAR },
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
    });
    const scholarUrl = person?.links[0]?.url;
    if (!person || !scholarUrl) return;
    const scholarUserId = new URL(scholarUrl).searchParams.get('user');
    if (!scholarUserId) {
      await this.recordScholarFailure(
        personId,
        scholarUrl,
        null,
        'Scholar link does not contain a profile user ID',
        SourceFetchStatus.UNAVAILABLE,
      );
      return;
    }

    try {
      const url = new URL('https://scholar.google.com/citations');
      url.searchParams.set('user', scholarUserId);
      url.searchParams.set('hl', 'en');
      const response = await this.fetcher.fetch(url.toString(), 'text/html');
      const html = response.body.toString('utf8');
      if (/unusual traffic|recaptcha|not a robot/i.test(html)) {
        throw new SourceUnavailableError('Google Scholar requested a CAPTCHA');
      }
      const $ = cheerio.load(html);
      const citationText = $('#gsc_rsb_st .gsc_rsb_std').first().text().trim();
      const citationCount = Number(citationText.replace(/[^0-9]/g, ''));
      if (!citationText || !Number.isSafeInteger(citationCount)) {
        throw new SourceUnavailableError(
          'Google Scholar citation total was not present',
        );
      }
      const now = new Date();
      await this.prisma.personMetric.upsert({
        where: { personId },
        create: {
          personId,
          scholarAttemptedAt: now,
          scholarCitationCount: citationCount,
          scholarFailureCount: 0,
          scholarStatus: SourceFetchStatus.FETCHED,
          scholarSyncedAt: now,
          scholarUrl,
          scholarUserId,
        },
        update: {
          scholarAttemptedAt: now,
          scholarCitationCount: citationCount,
          scholarFailureCount: 0,
          scholarFailureReason: null,
          scholarNextAttemptAt: null,
          scholarStatus: SourceFetchStatus.FETCHED,
          scholarSyncedAt: now,
          scholarUrl,
          scholarUserId,
        },
      });
      await this.recalculate(personId);
    } catch (error) {
      await this.recordScholarFailure(
        personId,
        scholarUrl,
        scholarUserId,
        error instanceof Error ? error.message : String(error),
        error instanceof SourceUnavailableError
          ? SourceFetchStatus.UNAVAILABLE
          : SourceFetchStatus.FAILED,
      );
    }
  }

  private async recordScholarFailure(
    personId: string,
    scholarUrl: string,
    scholarUserId: string | null,
    reason: string,
    status: SourceFetchStatus,
  ): Promise<void> {
    const metric = await this.prisma.personMetric.findUnique({
      where: { personId },
    });
    const failures = (metric?.scholarFailureCount ?? 0) + 1;
    const nextAttempt = new Date(
      Date.now() + Math.min(MAX_BACKOFF, 2 ** Math.min(failures - 1, 6) * DAY),
    );
    await this.prisma.personMetric.upsert({
      where: { personId },
      create: {
        personId,
        scholarAttemptedAt: new Date(),
        scholarFailureCount: failures,
        scholarFailureReason: reason,
        scholarNextAttemptAt: nextAttempt,
        scholarStatus: status,
        scholarUrl,
        scholarUserId,
      },
      update: {
        scholarAttemptedAt: new Date(),
        scholarFailureCount: failures,
        scholarFailureReason: reason,
        scholarNextAttemptAt: nextAttempt,
        scholarStatus: status,
        scholarUrl,
        scholarUserId,
      },
    });
  }
}

function recordString(value: Prisma.JsonValue, key: string): string {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`Job payload requires ${key}`);
  }
  const candidate = value[key];
  if (typeof candidate !== 'string')
    throw new Error(`Job payload requires ${key}`);
  return candidate;
}
