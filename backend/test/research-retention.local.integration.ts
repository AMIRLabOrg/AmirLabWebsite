import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import { validateEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { JobsService } from '../src/jobs/jobs.service';
import { PublicCacheService } from '../src/public-cache/public-cache.service';
import { ResearchRetentionService } from '../src/research/research-retention.service';

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
    JOB_CONCURRENCY: '2',
    NODE_ENV: 'test',
    STORAGE_PROVIDER: 'local',
  }),
);
const prisma = new PrismaService(config);
const jobs = new JobsService(prisma, config);
const cache = new PublicCacheService(config, jobs, prisma);
const retention = new ResearchRetentionService(jobs, prisma, cache);
const runNext = () =>
  (
    jobs as unknown as {
      runNext(): Promise<void>;
    }
  ).runNext();

async function main() {
  await prisma.$connect();
  retention.onModuleInit();
  const actor = await prisma.user.create({
    data: {
      email: `${randomUUID()}@local.test`,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  const firstUser = await prisma.user.create({
    data: { email: `${randomUUID()}@local.test`, status: 'ACTIVE' },
  });
  const first = await prisma.person.create({
    data: {
      expertise: [],
      fullName: 'Retention first',
      slug: randomUUID(),
      userId: firstUser.id,
    },
  });
  const second = await prisma.person.create({
    data: { expertise: [], fullName: 'Retention second', slug: randomUUID() },
  });
  const third = await prisma.person.create({
    data: { expertise: [], fullName: 'Retention third', slug: randomUUID() },
  });
  const item = await prisma.researchItem.create({
    data: {
      openAlexWorkId: `W9${Date.now()}`,
      reviewStatus: 'PUBLISHED',
      slug: randomUUID(),
      title: 'Retention fixture',
      type: 'PAPER',
      paper: { create: { doi: `10.9999/${randomUUID()}` } },
      people: {
        create: [
          { authorId: 'A1', personId: first.id },
          { authorId: 'A2', isCurrent: false, personId: second.id },
        ],
      },
    },
  });
  const priorRevision = await prisma.siteSetting.findUnique({
    where: { key: 'cache.public.revision' },
  });

  try {
    await retention.removePerson(first.id, actor.id);
    assert.ok(
      await prisma.person.findUnique({ where: { id: second.id } }),
      'remove_first_coauthor_retains_other_people',
    );
    assert.equal(
      await prisma.person.findUnique({ where: { id: first.id } }),
      null,
    );
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: firstUser.id } }))
        .isDeleted,
      true,
      'person removal trashes rather than erases the login account',
    );
    await runNext();
    assert.ok(
      await prisma.researchItem.findUnique({ where: { id: item.id } }),
      'inactive_association_blocks_delete',
    );

    await retention.removePerson(second.id, actor.id);
    await prisma.personResearchItem.create({
      data: {
        authorId: 'A3',
        personId: third.id,
        researchItemId: item.id,
      },
    });
    await runNext();
    assert.ok(
      await prisma.researchItem.findUnique({ where: { id: item.id } }),
      'new_association_racing_cleanup_wins_safely',
    );

    await retention.removePerson(third.id, actor.id);
    await runNext();
    assert.equal(
      await prisma.researchItem.findUnique({ where: { id: item.id } }),
      null,
      'remove_last_person_allows_cleanup',
    );
  } finally {
    await prisma.job.deleteMany({
      where: {
        OR: [
          { uniqueKey: { startsWith: 'research-cleanup:' } },
          { uniqueKey: { startsWith: 'public-cache:research-cleanup:' } },
        ],
      },
    });
    await prisma.auditRecord.deleteMany({
      where: { actorId: actor.id, action: 'person.removed' },
    });
    await prisma.person.deleteMany({
      where: { id: { in: [first.id, second.id, third.id] } },
    });
    await prisma.researchItem.deleteMany({ where: { id: item.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [actor.id, firstUser.id] } },
    });
    if (priorRevision)
      await prisma.siteSetting.update({
        where: { key: 'cache.public.revision' },
        data: { value: priorRevision.value ?? Prisma.JsonNull },
      });
    else
      await prisma.siteSetting.deleteMany({
        where: { key: 'cache.public.revision' },
      });
    await prisma.$disconnect();
  }
}

void main();
