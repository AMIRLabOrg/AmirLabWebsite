import { Test } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { OpenAlexClient, OpenAlexRequestError } from './openalex-client';
import { JobsService } from '../jobs/jobs.service';
import { RankingsService } from './rankings.service';
import { OpenAlexService } from './openalex.service';
import { OpenAlexImporter } from './openalex-importer';
import { PublicCacheService } from '../public-cache/public-cache.service';
import type { JobContext } from '../jobs/job-context';

describe('OpenAlex source from existing profile links', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    openAlexProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    researchItem: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    weeklyReportOutput: { deleteMany: jest.fn() },
    researchProgramItem: { deleteMany: jest.fn() },
    researchContributor: { updateMany: jest.fn() },
    contributorMatch: { deleteMany: jest.fn() },
    job: { upsert: jest.fn() },
    personResearchItem: { updateMany: jest.fn() },
    personProfileSection: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn(),
    },
  };
  const client = {
    fetchAuthorWorks: jest.fn(),
    fetchAuthorCitationCount: jest.fn(),
  };
  const jobs = {
    assertActiveJob: jest.fn(),
    completeJob: jest.fn(),
    enqueueWhileActive: jest.fn(),
  };
  const rankings = { recalculateMany: jest.fn() };
  const publicCache = { invalidateInTransaction: jest.fn() };
  const context = (): JobContext => ({
    jobId: 'job',
    leaseToken: '00000000-0000-0000-0000-000000000001',
    signal: new AbortController().signal,
  });
  let service: OpenAlexService;
  let db: PrismaService;
  beforeEach(async () => {
    jest.clearAllMocks();
    client.fetchAuthorWorks.mockReset();
    client.fetchAuthorCitationCount.mockReset().mockResolvedValue(120);
    prisma.openAlexProfile.findUnique.mockResolvedValue(null);
    prisma.$queryRaw.mockResolvedValue([{ version: 1n }]);
    prisma.researchItem.findMany.mockResolvedValue([]);
    prisma.openAlexProfile.upsert.mockResolvedValue({
      personId: 'person',
      authorId: 'A123',
      bindingVersion: 2,
    });
    prisma.$transaction.mockImplementation(
      (run: (db: typeof prisma) => unknown) => run(prisma),
    );
    const module = await Test.createTestingModule({
      providers: [
        OpenAlexService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAlexClient, useValue: client },
        { provide: JobsService, useValue: jobs },
        { provide: RankingsService, useValue: rankings },
        { provide: PublicCacheService, useValue: publicCache },
      ],
    }).compile();
    service = module.get(OpenAlexService);
    db = module.get(PrismaService);
  });
  it('binds the existing OpenAlex URL and clears old outputs when the source changes', async () => {
    await service.applyAuthorId('person', 'a123', db);
    expect(prisma.openAlexProfile.upsert).toHaveBeenCalled();
    expect(prisma.researchContributor.updateMany).toHaveBeenCalled();
    expect(prisma.contributorMatch.deleteMany).toHaveBeenCalled();
  });
  it('clearing the link clears old associations and pauses sync', async () => {
    prisma.openAlexProfile.findUnique.mockResolvedValue({
      personId: 'person',
      authorId: 'A123',
      bindingVersion: 2,
    });
    await service.applyAuthorId('person', null, db);
    const call = prisma.openAlexProfile.upsert.mock.calls[0] as unknown[];
    expect(call[0]).toMatchObject({
      update: {
        authorId: null,
        citationCount: null,
        status: 'IDLE',
        bindingVersion: 3,
      },
    });
    expect(prisma.researchContributor.updateMany).toHaveBeenCalled();
  });
  it('retains a canonical output even when its last author binding is cleared', async () => {
    prisma.openAlexProfile.findUnique.mockResolvedValue({
      personId: 'person',
      authorId: 'A123',
      bindingVersion: 2,
    });
    prisma.researchItem.findMany.mockResolvedValue([{ id: 'shared-output' }]);

    await service.applyAuthorId('person', null, db);

    expect(prisma.researchContributor.updateMany).toHaveBeenCalledWith({
      where: { personId: 'person' },
      data: { personId: null },
    });
    expect(prisma.researchItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.weeklyReportOutput.deleteMany).not.toHaveBeenCalled();
    expect(prisma.researchProgramItem.deleteMany).not.toHaveBeenCalled();
  });
  it('leaves an unchanged link and profiles without a source alone', async () => {
    await service.applyAuthorId('person', null, db);
    expect(prisma.researchContributor.updateMany).not.toHaveBeenCalled();
    prisma.openAlexProfile.findUnique.mockResolvedValue({
      personId: 'person',
      authorId: 'A123',
    });
    await service.applyAuthorId('person', 'A123', db);
    expect(prisma.openAlexProfile.upsert).not.toHaveBeenCalled();
    await service.applyAuthorId('person', undefined, db);
    expect(prisma.openAlexProfile.upsert).not.toHaveBeenCalled();
  });
  it('uses the revision to discard a result fetched before a link changed', async () => {
    prisma.openAlexProfile.findUnique
      .mockResolvedValueOnce({
        authorId: 'A123',
        bindingVersion: 2,
        failureCount: 0,
      })
      .mockResolvedValueOnce({ authorId: null, bindingVersion: 3 });
    client.fetchAuthorWorks.mockResolvedValue({
      declaredCount: 0,
      presentWorkIds: [],
      warnings: [],
      works: [],
    });
    await service.sync('person', 2, context());
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.openAlexProfile.updateMany).toHaveBeenCalledTimes(1);
  });
  it('backs off a partial/rate-limited fetch without a successful marker', async () => {
    prisma.openAlexProfile.findUnique.mockResolvedValue({
      authorId: 'A123',
      bindingVersion: 2,
      failureCount: 0,
    });
    client.fetchAuthorWorks.mockRejectedValue(
      new OpenAlexRequestError('Rate limit', 600000),
    );
    await expect(service.sync('person', 2, context())).rejects.toThrow(
      'Rate limit',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    const call = prisma.openAlexProfile.updateMany.mock.calls[1] as unknown[];
    expect(call[0]).toMatchObject({ data: { status: 'FAILED' } });
  });
  it('stores citation totals with successful imports and recalculates even an author with no works', async () => {
    prisma.openAlexProfile.findUnique.mockResolvedValue({
      personId: 'person',
      authorId: 'A123',
      bindingVersion: 2,
      failureCount: 0,
    });
    client.fetchAuthorWorks.mockResolvedValue({
      declaredCount: 0,
      presentWorkIds: [],
      warnings: [],
      works: [],
    });
    const apply = jest
      .spyOn(OpenAlexImporter.prototype, 'apply')
      .mockResolvedValue({
        outputIds: [],
        changedOutputIds: [],
        personIds: [],
        summary: {
          fetched: 0,
          imported: 0,
          skipped: [],
          missing: [],
          warnings: 0,
        },
      });
    try {
      await service.sync('person', 2, context());
      const call = prisma.openAlexProfile.update.mock.calls[0] as unknown[];
      expect(call[0]).toMatchObject({
        where: { personId: 'person' },
        data: { citationCount: 120, status: 'SUCCEEDED' },
      });
      expect(rankings.recalculateMany).toHaveBeenCalledWith(
        ['person'],
        undefined,
        prisma,
      );
    } finally {
      apply.mockRestore();
    }
  });

  it('keeps saved metrics when the author citation request fails', async () => {
    prisma.openAlexProfile.findUnique.mockResolvedValue({
      authorId: 'A123',
      bindingVersion: 2,
      failureCount: 0,
    });
    client.fetchAuthorWorks.mockResolvedValue({
      declaredCount: 0,
      presentWorkIds: [],
      warnings: [],
      works: [],
    });
    client.fetchAuthorCitationCount.mockRejectedValueOnce(
      new OpenAlexRequestError('invalid citation metadata'),
    );
    await expect(service.sync('person', 2, context())).rejects.toThrow(
      'invalid citation metadata',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.openAlexProfile.update).not.toHaveBeenCalled();
  });
});
