import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ResearchService } from '../src/research/research.service';
import { ResearchDiscoveryService } from '../src/research/research-discovery.service';
import { ResearchRelationshipsService } from '../src/research/research-relationships.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { SettingsService } from '../src/settings/settings.service';
import { PublicationQueryDto } from '../src/research/dto/publication-query.dto';
import { PublicationCategory } from '../src/research/publication-category';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/database/prisma.service';
import { validateEnvironment } from '../src/config/environment';
import { OpenAlexImporter } from '../src/research/openalex-importer';
import { OpenAlexService } from '../src/research/openalex.service';
import { OpenAlexClient } from '../src/research/openalex-client';
import type { OpenAlexWork } from '../src/research/openalex-client';
import { JobsService } from '../src/jobs/jobs.service';
import { RankingsService } from '../src/research/rankings.service';
import { ResearchProfileSyncService } from '../src/research/research-profile-sync.service';
import { resolveService } from './resolve-service';
import { assertLocalTarget } from '../scripts/reset-local-papers';
const url = assertLocalTarget(
  process.env.DATABASE_URL,
  '--replace-local-papers',
);
const prisma = new PrismaService(
  new ConfigService(
    validateEnvironment({
      DATABASE_URL: url,
      NODE_ENV: 'test',
      FRONTEND_ORIGINS: 'http://localhost:3000',
      ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      STORAGE_PROVIDER: 'local',
    }),
  ),
);
// tsx does not emit Nest constructor metadata; these integration readers use explicit test DI.
Reflect.defineMetadata(
  'design:paramtypes',
  [
    ResearchDiscoveryService,
    NotificationsService,
    PrismaService,
    ResearchProfileSyncService,
    RankingsService,
    SettingsService,
  ],
  ResearchService,
);
Reflect.defineMetadata(
  'design:paramtypes',
  [
    NotificationsService,
    PrismaService,
    ResearchProfileSyncService,
    ResearchService,
  ],
  ResearchRelationshipsService,
);
const rollback = new Error('ROLLBACK_TEST_FIXTURES');
const failures: string[] = [];
function check(name: string, action: () => void) {
  try {
    action();
  } catch (error) {
    failures.push(
      `${name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function firstBindingRace(service: OpenAlexService) {
  const person = await prisma.person.create({
    data: {
      fullName: 'Disposable source race fixture',
      slug: randomUUID(),
      expertise: [],
    },
  });
  let releaseFirst = () => {};
  let prepared = () => {};
  let compared = () => {};
  const resume = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    prepared = resolve;
  });
  const comparison = new Promise<void>((resolve) => {
    compared = resolve;
  });
  const first = prisma.$transaction(
    async (db) => {
      await service.applyLinks(
        person.id,
        [{ type: 'OPENALEX', url: 'https://openalex.org/A900101' }],
        db,
      );
      await db.person.update({
        where: { id: person.id },
        data: {
          links: {
            create: {
              type: 'OPENALEX',
              label: 'OpenAlex',
              sortOrder: 0,
              url: 'https://openalex.org/A900101',
            },
          },
        },
      });
      prepared();
      await resume;
    },
    { timeout: 10000 },
  );
  let second: Promise<unknown> | undefined;
  try {
    await Promise.race([
      ready,
      first.then(() => {
        throw new Error('First binding finished before test coordination');
      }),
    ]);
    second = prisma.$transaction(
      async (db) => {
        await service.applyLinks(person.id, [], db);
        compared();
        await db.person.update({
          where: { id: person.id },
          data: { links: { deleteMany: {} } },
        });
      },
      { timeout: 10000 },
    );
    const readBeforeCommit = await Promise.race([
      comparison.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500)),
    ]);
    check('first-binding comparison serializes on stable person row', () =>
      assert.equal(readBeforeCommit, false),
    );
    releaseFirst();
    await Promise.all([first, second]);
    const source = await prisma.openAlexProfile.findUniqueOrThrow({
      where: { personId: person.id },
    });
    check('concurrent linkless save clears first source binding', () =>
      assert.equal(source.authorId, null),
    );
  } finally {
    releaseFirst();
    await Promise.allSettled(second ? [first, second] : [first]);
    await prisma.person.delete({ where: { id: person.id } });
  }
}
async function main() {
  const service = await resolveService(OpenAlexService, [
    { provide: PrismaService, useValue: prisma },
    { provide: OpenAlexClient, useValue: {} },
    { provide: JobsService, useValue: {} },
    { provide: RankingsService, useValue: {} },
    { provide: ResearchProfileSyncService, useValue: {} },
  ]);
  try {
    await prisma.$transaction(
      async (db) => {
        const one = await db.person.create({
          data: {
            fullName: 'Disposable author one',
            isPublished: true,
            user: {
              create: {
                email: `${randomUUID()}@local.amirlab.test`,
                status: 'ACTIVE',
                role: 'ADMIN',
              },
            },
            slug: randomUUID(),
            expertise: [],
          },
        });
        const two = await db.person.create({
          data: {
            fullName: 'Disposable author two',
            slug: randomUUID(),
            expertise: [],
          },
        });
        const p1 = await db.openAlexProfile.create({
          data: { personId: one.id, authorId: 'A101', bindingVersion: 1 },
        });
        const p2 = await db.openAlexProfile.create({
          data: { personId: two.id, authorId: 'A102', bindingVersion: 1 },
        });
        const base: OpenAlexWork = {
          id: 'W900000000000001',
          doi: '10.9999/openalex-integration-1',
          title: 'Disposable paper',
          year: 2025,
          venue: 'Source venue',
          type: 'article',
          publicationDate: null,
          isRetracted: false,
          authors: [
            { id: 'A101', name: one.fullName, orcid: null },
            { id: 'A102', name: two.fullName, orcid: null },
          ],
        };
        const reader = await resolveService(ResearchService, [
          { provide: PrismaService, useValue: db },
          { provide: ResearchDiscoveryService, useValue: {} },
          { provide: NotificationsService, useValue: {} },
          { provide: ResearchProfileSyncService, useValue: {} },
          { provide: RankingsService, useValue: {} },
          { provide: SettingsService, useValue: {} },
        ]);
        const importer = new OpenAlexImporter(db);
        await importer.apply(p1, [base]);
        await importer.apply(p2, [base]);
        await importer.apply(p1, [base]);
        let output = await db.researchItem.findUniqueOrThrow({
          where: { openAlexWorkId: base.id },
          include: { paper: true, contributors: true },
        });
        assert.equal(
          await db.researchItem.count({ where: { openAlexWorkId: base.id } }),
          1,
        );
        assert.equal(
          output.contributors.filter((row) => row.personId).length,
          2,
        );
        const facet = await reader.publications(
          Object.assign(new PublicationQueryDto(), {
            category: PublicationCategory.JOURNAL,
            search: 'Disposable paper',
          }),
        );
        check('canonical publication filters', () =>
          assert(facet.items.some((item) => item.id === output.id)),
        );
        const beforeOrderVersion = output.automationVersion;
        await db.researchItem.update({
          where: { id: output.id },
          data: { title: 'Curated title' },
        });
        await importer.apply(p1, [
          {
            ...base,
            title: 'Upstream title',
            venue: 'New venue',
            authors: [...base.authors].reverse(),
          },
        ]);
        output = await db.researchItem.findUniqueOrThrow({
          where: { openAlexWorkId: base.id },
          include: { paper: true, contributors: true },
        });
        assert.equal(output.title, 'Curated title');
        assert.equal(output.paper?.venue, 'New venue');
        assert.equal(
          output.contributors.find((row) => row.openAlexAuthorId === 'A102')
            ?.sortOrder,
          0,
        );
        check('author reorder advances review revision', () =>
          assert(output.automationVersion > beforeOrderVersion),
        );
        assert(one.userId);
        const relationships = await resolveService(
          ResearchRelationshipsService,
          [
            {
              provide: PrismaService,
              useValue: {
                researchContributor: db.researchContributor,
                person: db.person,
                researchItem: db.researchItem,
                $transaction: (
                  run: (
                    transaction: Prisma.TransactionClient,
                  ) => Promise<unknown>,
                ) => run(db),
              },
            },
            { provide: NotificationsService, useValue: {} },
            {
              provide: ResearchProfileSyncService,
              useValue: { normalizePublishedOutputs: async () => {} },
            },
            {
              provide: ResearchService,
              useValue: { recalculateRank: async () => {} },
            },
          ],
        );
        await db.$executeRaw`SAVEPOINT stale_review_test`;
        let staleRejected = false;
        try {
          await relationships.link(
            output.id,
            0,
            { expectedAutomationVersion: beforeOrderVersion, personId: one.id },
            {
              id: one.userId,
              email: null,
              role: 'ADMIN',
              status: 'ACTIVE',
              person: null,
            },
          );
        } catch (error) {
          staleRejected = error instanceof ConflictException;
        }
        await db.$executeRaw`ROLLBACK TO SAVEPOINT stale_review_test`;
        check('stale author-slot action receives conflict', () =>
          assert(staleRejected),
        );
        const missing = await importer.apply(p1, []);
        assert.deepEqual(missing.summary.missing, [base.id]);
        assert.equal(
          await db.researchContributor.count({
            where: { researchItemId: output.id, personId: one.id },
          }),
          1,
        );
        assert.match(
          (await importer.apply(p1, [{ ...base, id: 'W900000000000002' }]))
            .summary.skipped[0]?.reason ?? '',
          /Conflicting/,
        );
        const dataset = {
          ...base,
          id: 'W900000000000003',
          doi: '10.9999/test-dataset',
          type: 'dataset',
          title: 'Dataset',
          authors: [base.authors[0]],
        };
        await importer.apply(p1, [dataset]);
        assert.equal(
          (
            await db.researchItem.findUniqueOrThrow({
              where: { openAlexWorkId: dataset.id },
            })
          ).type,
          'DATASET',
        );
        const retracted = {
          ...base,
          id: 'W900000000000004',
          doi: '10.9999/review-retracted',
          authors: [base.authors[0]],
          isRetracted: true,
        };
        await importer.apply(p1, [retracted]);
        await db.researchItem.update({
          where: { openAlexWorkId: retracted.id },
          data: { reviewStatus: 'REJECTED' },
        });
        await importer.apply(p1, [retracted]);
        const retractionResult = await db.researchItem.findUniqueOrThrow({
          where: { openAlexWorkId: retracted.id },
        });
        check('repeated retraction preserves moderator rejection', () =>
          assert.equal(retractionResult.reviewStatus, 'REJECTED'),
        );
        await db.researchItem.update({
          where: { id: output.id },
          data: { submittedById: one.userId },
        });
        await db.personProfileSection.createMany({
          data: ['Datasets', 'Papers', 'Research interests'].map(
            (title, sortOrder) => ({
              personId: one.id,
              type: 'OTHER',
              title,
              sortOrder,
            }),
          ),
        });
        const unlinked = await db.researchItem.create({
          data: {
            type: 'PAPER',
            slug: randomUUID(),
            title: 'Unlinked decision',
            paper: { create: {} },
            contributors: {
              create: [
                { sortOrder: 0, displayName: one.fullName },
                { sortOrder: 1, displayName: two.fullName, personId: two.id },
              ],
            },
          },
        });
        await db.contributorMatch.create({
          data: {
            researchItemId: unlinked.id,
            contributorSortOrder: 0,
            personId: one.id,
            status: 'REJECTED',
            source: 'ADMIN_MANUAL',
            evidence: {},
          },
        });
        // Changing a link clears all old paper/dataset associations, even reviewed ones.
        await db.contributorMatch.updateMany({
          where: { personId: one.id },
          data: { source: 'ADMIN_MANUAL' },
        });
        await service.applyLinks(
          one.id,
          [{ type: 'OPENALEX', url: 'https://openalex.org/A103' }],
          db,
        );
        assert.equal(
          await db.researchContributor.count({ where: { personId: one.id } }),
          0,
        );
        assert.equal(
          await db.researchItem.count({
            where: { openAlexWorkId: dataset.id },
          }),
          0,
          'unshared dataset deleted',
        );
        assert.equal(
          await db.researchItem.count({ where: { openAlexWorkId: base.id } }),
          1,
          'coauthor keeps shared paper',
        );
        const formerProfile = await reader.personBySlug(one.slug);
        check('shared submission disappears from former public profile', () =>
          assert(
            !formerProfile.contributions.some(
              (row) => row.researchItem.id === output.id,
            ),
          ),
        );
        const decisionCount = await db.contributorMatch.count({
          where: { personId: one.id },
        });
        check('all previous contributor decisions removed', () =>
          assert.equal(decisionCount, 0),
        );
        const oldSections = await db.personProfileSection.findMany({
          where: { personId: one.id },
        });
        check('old manual output sections removed; interests retained', () =>
          assert.deepEqual(
            oldSections.map((row) => row.title),
            ['Research interests'],
          ),
        );
        const oldRetractions = await db.researchItem.count({
          where: { openAlexWorkId: retracted.id },
        });
        check('unlinked old-source retraction cleared', () =>
          assert.equal(oldRetractions, 0),
        );
        const newProfile = await db.openAlexProfile.findUniqueOrThrow({
          where: { personId: one.id },
        });
        await importer.apply(newProfile, [
          {
            ...base,
            id: 'W900000000000005',
            doi: '10.9999/new-source',
            authors: [{ id: 'A103', name: one.fullName, orcid: null }],
          },
        ]);
        check('new source data replaces previous profile outputs', () =>
          assert.equal(newProfile.authorId, 'A103'),
        );
        await service.applyLinks(one.id, [], db);
        await service.applyLinks(two.id, [], db);
        assert.equal(
          await db.researchItem.count({ where: { openAlexWorkId: base.id } }),
          0,
          'unshared old paper deleted',
        );
        console.log(
          'CHECKED: idempotent shared papers, datasets, local corrections, author order, missing upstream, DOI conflicts, immediate replacement/removal and coauthor preservation',
        );
        throw rollback;
      },
      { timeout: 60000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    try {
      await firstBindingRace(service);
    } finally {
      await prisma.$disconnect();
    }
  }
  if (failures.length) throw new Error(failures.join('\n'));
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
