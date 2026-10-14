import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { JobContext } from '../jobs/job-context';
import { CLEANUP_RESEARCH_OUTPUTS_JOB } from '../jobs/job-types';
import { JobsService } from '../jobs/jobs.service';
import { PublicCacheService } from '../public-cache/public-cache.service';
import { lockAdministratorChange } from '../users/admin-change-lock';

@Injectable()
export class ResearchRetentionService implements OnModuleInit {
  constructor(
    private readonly jobs: JobsService,
    private readonly prisma: PrismaService,
    private readonly publicCache: PublicCacheService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(CLEANUP_RESEARCH_OUTPUTS_JOB, (payload, context) =>
      this.cleanup(payload, context),
    );
  }

  async removePerson(personId: string, actorId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await lockAdministratorChange(transaction, null);
      await transaction.$queryRaw`SELECT "id" FROM "Person" WHERE "id" = ${personId}::uuid FOR UPDATE`;
      const person = await transaction.person.findUnique({
        where: { id: personId },
        include: { user: true },
      });
      if (!person) throw new NotFoundException('Person not found');
      if (person.userId === actorId)
        throw new ConflictException('You cannot remove your own profile');
      const ownedProjects = await transaction.projectMembership.count({
        where: {
          personId,
          role: 'OWNER',
          status: 'ACTIVE',
          project: { status: { in: ['PLANNED', 'ACTIVE', 'PAUSED'] } },
        },
      });
      const ledPrograms = await transaction.researchProgram.count({
        where: {
          leadId: personId,
          status: { in: ['PLANNED', 'ACTIVE', 'PAUSED'] },
        },
      });
      if (ownedProjects || ledPrograms)
        throw new ConflictException(
          'Reassign active project ownership and program leadership first.',
        );
      await lockAdministratorChange(transaction, person.userId);
      const associations = await transaction.personResearchItem.findMany({
        where: { personId },
        select: { researchItemId: true },
      });
      const outputIds = associations.map(
        ({ researchItemId }) => researchItemId,
      );
      if (person.userId) {
        await transaction.session.updateMany({
          where: { userId: person.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await transaction.user.update({
          where: { id: person.userId },
          data: {
            deletedAt: person.user?.deletedAt ?? new Date(),
            isDeleted: true,
            status: 'ARCHIVED',
          },
        });
      }
      await transaction.auditRecord.create({
        data: {
          action: 'person.removed',
          actorId,
          entityId: personId,
          entityType: 'Person',
          details: { outputIds },
        },
      });
      await transaction.person.delete({ where: { id: personId } });
      if (outputIds.length)
        await transaction.job.upsert({
          where: { uniqueKey: `research-cleanup:${personId}` },
          update: {},
          create: {
            payload: { outputIds },
            type: CLEANUP_RESEARCH_OUTPUTS_JOB,
            uniqueKey: `research-cleanup:${personId}`,
          },
        });
      return { removed: true };
    });
  }

  private async cleanup(payload: Prisma.JsonValue, context: JobContext) {
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      !Array.isArray(payload.outputIds) ||
      payload.outputIds.some((id) => typeof id !== 'string')
    )
      throw new Error('Invalid research cleanup job');
    const outputIds = [...new Set(payload.outputIds as string[])].sort();
    await this.prisma.$transaction(async (transaction) => {
      await this.jobs.assertActiveJob(transaction, context);
      let removed = 0;
      for (const outputId of outputIds) {
        const item = await transaction.researchItem.findUnique({
          where: { id: outputId },
          select: { openAlexWorkId: true, paper: { select: { doi: true } } },
        });
        if (!item) continue;
        const key = item.openAlexWorkId
          ? `openalex:${item.openAlexWorkId}`
          : item.paper?.doi
            ? `doi:${item.paper.doi}`
            : `item:${outputId}`;
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
        removed += await transaction.$executeRaw`
          DELETE FROM "ResearchItem" AS item
          WHERE item."id" = ${outputId}::uuid
            AND item."type" IN ('PAPER'::"ResearchItemType", 'DATASET'::"ResearchItemType")
            AND NOT EXISTS (
              SELECT 1
              FROM "PersonResearchItem" AS association
              WHERE association."researchItemId" = item."id"
            )
        `;
      }
      if (removed)
        await this.publicCache.invalidateInTransaction(
          transaction,
          `research-cleanup:${context.jobId}`,
        );
      await this.jobs.completeJob(transaction, context);
    });
  }
}
