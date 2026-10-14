import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { OpenAlexProfile } from '../generated/prisma/client';
import { validateEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import type {
  OpenAlexAuthorSnapshot,
  OpenAlexWork,
} from '../src/research/openalex-client';
import { OpenAlexImporter } from '../src/research/openalex-importer';

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
const prisma = new PrismaService(
  new ConfigService(
    validateEnvironment({
      DATABASE_URL: databaseUrl,
      ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      FRONTEND_ORIGINS: 'http://localhost:3000',
      NODE_ENV: 'test',
      STORAGE_PROVIDER: 'local',
    }),
  ),
);

function snapshot(
  works: OpenAlexWork[],
  presentWorkIds = works.map(({ id }) => id),
  warnings: OpenAlexAuthorSnapshot['warnings'] = [],
): OpenAlexAuthorSnapshot {
  return {
    declaredCount: presentWorkIds.length,
    presentWorkIds,
    warnings,
    works,
  };
}

async function main() {
  await prisma.$connect();
  const rollback = new Error('ROLLBACK_OPENALEX_FIXTURE');
  try {
    await assert.rejects(
      prisma.$transaction(
        async (db) => {
          const people = await Promise.all(
            ['A101', 'A102', 'A103'].map((authorId) =>
              db.person.create({
                data: {
                  expertise: [],
                  fullName: `Disposable ${authorId}`,
                  slug: randomUUID(),
                  openAlexProfile: {
                    create: { authorId, bindingVersion: 1 },
                  },
                },
                include: { openAlexProfile: true },
              }),
            ),
          );
          const profiles = people.map(
            ({ openAlexProfile }) => openAlexProfile as OpenAlexProfile,
          );
          const work: OpenAlexWork = {
            authors: [
              { id: 'A101', name: 'Disposable A101', orcid: null },
              { id: 'A102', name: 'Disposable A102', orcid: null },
            ],
            doi: `10.9999/${randomUUID()}`,
            id: 'W900000000000001',
            isRetracted: false,
            publicationDate: '2025-01-01',
            title: 'Shared transactional source work',
            type: 'article',
            venue: 'Fixture journal',
            year: 2025,
          };

          await new OpenAlexImporter(db).apply(
            profiles[0],
            snapshot([work]),
            10n,
          );
          await new OpenAlexImporter(db).apply(
            profiles[1],
            snapshot([work]),
            11n,
          );
          const item = await db.researchItem.findUniqueOrThrow({
            where: { openAlexWorkId: work.id },
            include: { contributors: true, people: true, sourceSnapshot: true },
          });
          assert.equal(
            await db.researchItem.count({ where: { openAlexWorkId: work.id } }),
            1,
          );
          assert.deepEqual(
            item.people.map(({ personId }) => personId).sort(),
            [people[0].id, people[1].id].sort(),
            'unchanged_work_still_adds_second_person',
          );

          await new OpenAlexImporter(db).apply(
            profiles[0],
            snapshot([{ ...work, authors: [...work.authors].reverse() }]),
            12n,
          );
          const reordered = await db.researchItem.findUniqueOrThrow({
            where: { id: item.id },
            include: { contributors: { orderBy: { sortOrder: 'asc' } } },
          });
          assert.deepEqual(
            reordered.contributors.map(
              ({ openAlexAuthorId }) => openAlexAuthorId,
            ),
            ['A102', 'A101'],
            'author_reorder_preserves_memberships',
          );
          assert.equal(
            await db.personResearchItem.count({
              where: { researchItemId: item.id, isCurrent: true },
            }),
            2,
          );

          await new OpenAlexImporter(db).apply(
            profiles[0],
            snapshot([{ ...work, isRetracted: true }]),
            9n,
          );
          assert.equal(
            (
              await db.researchItem.findUniqueOrThrow({
                where: { id: item.id },
              })
            ).reviewStatus,
            'PUBLISHED',
            'older_observation_cannot_reverse_retraction',
          );

          await new OpenAlexImporter(db).apply(
            profiles[0],
            snapshot(
              [],
              [work.id],
              [{ workId: work.id, reason: 'invalid fixture row' }],
            ),
            13n,
          );
          assert.deepEqual(
            await db.personResearchItem.findUniqueOrThrow({
              where: {
                personId_researchItemId: {
                  personId: people[0].id,
                  researchItemId: item.id,
                },
              },
              select: { isCurrent: true, missingSince: true },
            }),
            { isCurrent: true, missingSince: null },
            'invalid_present_work_keeps_last_good_listing',
          );

          await new OpenAlexImporter(db).apply(profiles[0], snapshot([]), 14n);
          assert.ok(
            (
              await db.personResearchItem.findUniqueOrThrow({
                where: {
                  personId_researchItemId: {
                    personId: people[0].id,
                    researchItemId: item.id,
                  },
                },
              })
            ).missingSince,
          );
          await new OpenAlexImporter(db).apply(profiles[0], snapshot([]), 15n);
          assert.equal(
            (
              await db.personResearchItem.findUniqueOrThrow({
                where: {
                  personId_researchItemId: {
                    personId: people[0].id,
                    researchItemId: item.id,
                  },
                },
              })
            ).isCurrent,
            false,
            'two_complete_jobs_confirm_absence',
          );
          assert.equal(
            (
              await db.personResearchItem.findUniqueOrThrow({
                where: {
                  personId_researchItemId: {
                    personId: people[1].id,
                    researchItemId: item.id,
                  },
                },
              })
            ).isCurrent,
            true,
            'one author observation cannot remove another author listing',
          );

          const workForThird = {
            ...work,
            authors: [
              ...work.authors,
              { id: 'A103', name: 'Disposable A103', orcid: null },
            ],
          };
          await new OpenAlexImporter(db).apply(
            profiles[2],
            snapshot([workForThird]),
            16n,
          );
          assert.equal(
            await db.personResearchItem.count({
              where: { researchItemId: item.id },
            }),
            3,
            'a later exact author binding adds only its own listing',
          );
          throw rollback;
        },
        { timeout: 60_000 },
      ),
      rollback,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
