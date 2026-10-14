import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  JobStatus,
  NotificationType,
  Prisma,
  ReviewStatus,
} from '../../generated/prisma/client';
import { RECALCULATE_ALL_RANKS_JOB } from '../jobs/job-types';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SettingsService,
  earnedRank,
  effectiveRank,
} from '../settings/settings.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RankingsService implements OnModuleInit {
  constructor(
    private readonly jobs: JobsService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobs.register(RECALCULATE_ALL_RANKS_JOB, async () => {
      await this.recalculateAll();
    });
    // Retire queued jobs from the previous scraper without fetching Scholar again.
    await this.prisma.job.updateMany({
      where: {
        type: 'SYNC_SCHOLAR_PROFILE',
        status: { in: [JobStatus.PENDING, JobStatus.RUNNING] },
      },
      data: {
        status: JobStatus.CANCELLED,
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        uniqueKey: null,
      },
    });
  }

  async recalculate(personId: string, actorId?: string): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: { openAlexProfile: true },
    });
    if (!person) return;
    const paperCount = await this.prisma.researchItem.count({
      where: {
        people: { some: { personId, isCurrent: true } },
        reviewStatus: ReviewStatus.PUBLISHED,
        type: 'PAPER',
      },
    });
    const policy = await this.settings.ranking();
    const nextEarned = earnedRank(
      paperCount,
      person.openAlexProfile?.authorId
        ? (person.openAlexProfile.citationCount ?? 0)
        : null,
      policy,
    );
    const previousEffective = effectiveRank(
      person.appointedRank,
      person.earnedRank,
    );
    const nextEffective = effectiveRank(person.appointedRank, nextEarned);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.personMetric.upsert({
        where: { personId },
        create: { personId, publishedPaperCount: paperCount },
        update: { publishedPaperCount: paperCount },
      });
      await transaction.person.update({
        where: { id: personId },
        data: { earnedRank: nextEarned },
      });
      await transaction.auditRecord.create({
        data: {
          action: 'person.rank-recalculated',
          actorId,
          entityId: personId,
          entityType: 'Person',
          details: {
            appointedRank: person.appointedRank,
            citationCount: person.openAlexProfile?.authorId
              ? (person.openAlexProfile.citationCount ?? 0)
              : null,
            earnedRank: { from: person.earnedRank, to: nextEarned },
            paperCount,
          },
        },
      });
    });
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
    db?: Prisma.TransactionClient,
  ): Promise<void> {
    const ids = [...new Set(personIds)];
    if (!ids.length) return;
    const policy = await this.settings.ranking();
    const recalculate = async (transaction: Prisma.TransactionClient) => {
      const people = await transaction.person.findMany({
        where: { id: { in: ids } },
        include: { openAlexProfile: true },
      });
      if (!people.length) return;
      const countRows = await transaction.$queryRaw<
        Array<{ personId: string; paperCount: number }>
      >(
        Prisma.sql`
          SELECT
            association."personId" AS "personId",
            COUNT(DISTINCT association."researchItemId")::integer AS "paperCount"
          FROM "PersonResearchItem" AS association
          INNER JOIN "ResearchItem" AS item
            ON item."id" = association."researchItemId"
          WHERE association."personId" IN (${Prisma.join(people.map(({ id }) => id))})
            AND association."isCurrent" = true
            AND item."reviewStatus" = 'PUBLISHED'::"ReviewStatus"
            AND item."type" = 'PAPER'::"ResearchItemType"
          GROUP BY association."personId"
        `,
      );
      const counts = new Map(
        countRows.map(({ paperCount, personId }) => [personId, paperCount]),
      );
      const changes = people.map((person) => {
        const paperCount = counts.get(person.id) ?? 0;
        const citationCount = person.openAlexProfile?.authorId
          ? (person.openAlexProfile.citationCount ?? 0)
          : null;
        const nextEarned = earnedRank(paperCount, citationCount, policy);
        return {
          citationCount,
          nextEarned,
          nextEffective: effectiveRank(person.appointedRank, nextEarned),
          paperCount,
          person,
          previousEffective: effectiveRank(
            person.appointedRank,
            person.earnedRank,
          ),
        };
      });
      const metricRows = changes.map(
        ({ paperCount, person }) =>
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

      const rankRows = changes.map(
        ({ nextEarned, person }) =>
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
        data: changes.map(
          ({ citationCount, nextEarned, paperCount, person }) => ({
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
          }),
        ),
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
        transaction,
      );
    };
    if (db) await recalculate(db);
    else await this.prisma.$transaction(recalculate);
  }

  async recalculateAll(): Promise<void> {
    const people = await this.prisma.person.findMany({ select: { id: true } });
    for (const { id } of people) await this.recalculate(id);
  }
}
