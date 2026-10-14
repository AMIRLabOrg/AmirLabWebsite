import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReviewStatus } from '../generated/prisma/client';
import { validateEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import type { JobsService } from '../src/jobs/jobs.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import {
  PUBLIC_CACHE_JOB,
  PublicCacheService,
} from '../src/public-cache/public-cache.service';
import { RankingsService } from '../src/research/rankings.service';
import {
  DEFAULT_RANK_POLICY,
  type SettingsService,
} from '../src/settings/settings.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL must select an amirl_sqa_* local database',
  );
}
const target = new URL(databaseUrl);
if (
  target.hostname !== '127.0.0.1' ||
  target.port !== '5433' ||
  !target.pathname.slice(1).startsWith('amirl_sqa_')
) {
  throw new Error('TEST_DATABASE_URL must select 127.0.0.1:5433/amirl_sqa_*');
}

const config = new ConfigService<ReturnType<typeof validateEnvironment>, true>(
  validateEnvironment({
    DATABASE_URL: databaseUrl,
    ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    FRONTEND_ORIGINS: 'http://localhost:3000',
    NODE_ENV: 'test',
    STORAGE_PROVIDER: 'local',
  }),
);
const prisma = new PrismaService(config);
const registered = new Map<string, (payload: unknown) => Promise<void>>();
const jobs = {
  register(type: string, handler: (payload: unknown) => Promise<void>) {
    registered.set(type, handler);
  },
} as JobsService;
const notifications = new NotificationsService(
  prisma,
  { enqueueNotification: () => Promise.resolve(undefined) } as never,
  jobs,
);
const rankings = new RankingsService(jobs, notifications, prisma, {
  ranking: () =>
    Promise.resolve({
      ...DEFAULT_RANK_POLICY,
      seniorCitationMinimum: 0,
      seniorPaperMinimum: 1,
    }),
} as SettingsService);
const cache = new PublicCacheService(config, jobs, prisma);

async function main() {
  await prisma.$connect();
  cache.onModuleInit();
  const prefix = `sqa.ranks-cache.${randomUUID()}`;
  const user = await prisma.user.create({
    data: { email: `${randomUUID()}@local.test`, status: 'ACTIVE' },
  });
  const person = await prisma.person.create({
    data: {
      expertise: [],
      fullName: 'Rank transaction fixture',
      slug: randomUUID(),
      userId: user.id,
      openAlexProfile: {
        create: { authorId: `A${Date.now()}`, citationCount: 10 },
      },
    },
  });
  const item = await prisma.researchItem.create({
    data: {
      reviewStatus: ReviewStatus.PUBLISHED,
      slug: randomUUID(),
      title: 'Transaction fixture paper',
      type: 'PAPER',
      paper: { create: { doi: `10.9999/${randomUUID()}` } },
      people: {
        create: { authorId: 'A1', personId: person.id },
      },
    },
  });
  const priorRevision = await prisma.siteSetting.findUnique({
    where: { key: 'cache.public.revision' },
  });

  try {
    await assert.rejects(
      prisma.$transaction(async (transaction) => {
        await rankings.recalculateMany([person.id], undefined, transaction);
        await cache.invalidateInTransaction(transaction, `${prefix}.rollback`);
        throw new Error('rollback fixture');
      }),
      /rollback fixture/,
    );
    assert.equal(
      await prisma.personMetric.count({ where: { personId: person.id } }),
      0,
    );
    assert.equal(
      await prisma.notification.count({ where: { recipientId: user.id } }),
      0,
    );
    assert.equal(
      await prisma.auditRecord.count({ where: { entityId: person.id } }),
      0,
    );
    assert.equal(
      await prisma.job.count({
        where: { uniqueKey: `public-cache:${prefix}.rollback` },
      }),
      0,
      'rollback_preserves_ranks_revision_and_delivery_queue',
    );
    assert.deepEqual(
      await prisma.siteSetting.findUnique({
        where: { key: 'cache.public.revision' },
      }),
      priorRevision,
    );

    await prisma.$transaction(async (transaction) => {
      await rankings.recalculateMany([person.id], undefined, transaction);
      await cache.invalidateInTransaction(transaction, `${prefix}.commit`);
    });
    assert.equal(
      await prisma.personMetric.count({ where: { personId: person.id } }),
      1,
    );
    assert.equal(
      await prisma.notification.count({ where: { recipientId: user.id } }),
      1,
    );
    assert.equal(
      await prisma.auditRecord.count({ where: { entityId: person.id } }),
      1,
    );
    assert.equal(
      await prisma.job.count({
        where: {
          status: 'PENDING',
          uniqueKey: `public-cache:${prefix}.commit`,
        },
      }),
      1,
      'committed_delivery_survives_restart',
    );
    const committedRevision = await cache.revision();
    const restarted = new PublicCacheService(config, jobs, prisma);
    assert.deepEqual(await restarted.revision(), committedRevision);

    const deliver = registered.get(PUBLIC_CACHE_JOB);
    assert.ok(deliver);
    await deliver({ revision: 'older-revision' });
    assert.deepEqual(
      await cache.revision(),
      committedRevision,
      'duplicate_webhook_does_not_regress_revision',
    );
  } finally {
    await prisma.job.deleteMany({
      where: { uniqueKey: { startsWith: `public-cache:${prefix}` } },
    });
    await prisma.auditRecord.deleteMany({ where: { entityId: person.id } });
    await prisma.person.delete({ where: { id: person.id } });
    await prisma.researchItem.delete({ where: { id: item.id } });
    await prisma.user.delete({ where: { id: user.id } });
    if (priorRevision) {
      await prisma.siteSetting.update({
        where: { key: 'cache.public.revision' },
        data: { value: priorRevision.value ?? Prisma.JsonNull },
      });
    } else {
      await prisma.siteSetting.deleteMany({
        where: { key: 'cache.public.revision' },
      });
    }
    await prisma.$disconnect();
  }
}

void main();
