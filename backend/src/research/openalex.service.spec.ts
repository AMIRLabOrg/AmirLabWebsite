import { Test } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { OpenAlexClient, OpenAlexRequestError } from './openalex-client';
import { JobsService } from '../jobs/jobs.service';
import { RankingsService } from './rankings.service';
import { ResearchProfileSyncService } from './research-profile-sync.service';
import { OpenAlexService } from './openalex.service';

describe('OpenAlex source from existing profile links', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    openAlexProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    researchItem: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    researchContributor: { updateMany: jest.fn() },
    contributorMatch: { deleteMany: jest.fn() },
    personProfileSection: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn(),
    },
  };
  const client = { fetchAuthorWorks: jest.fn() };
  const jobs = { enqueueWhileActive: jest.fn() };
  const rankings = { recalculateMany: jest.fn() };
  let service: OpenAlexService;
  let db: PrismaService;
  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.openAlexProfile.findUnique.mockResolvedValue(null);
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
        { provide: ResearchProfileSyncService, useValue: {} },
      ],
    }).compile();
    service = module.get(OpenAlexService);
    db = module.get(PrismaService);
  });
  it('binds the existing OpenAlex URL and clears old outputs when the source changes', async () => {
    await service.applyLinks(
      'person',
      [{ type: 'OPENALEX', url: 'https://openalex.org/authors/a123' }],
      db,
    );
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
    await service.applyLinks('person', [], db);
    const call = prisma.openAlexProfile.upsert.mock.calls[0] as unknown[];
    expect(call[0]).toMatchObject({
      update: {
        authorId: null,
        status: 'IDLE',
        bindingVersion: { increment: 1 },
      },
    });
    expect(prisma.researchContributor.updateMany).toHaveBeenCalled();
  });
  it('leaves an unchanged link and profiles without a source alone', async () => {
    await service.applyLinks('person', [], db);
    expect(prisma.researchContributor.updateMany).not.toHaveBeenCalled();
    prisma.openAlexProfile.findUnique.mockResolvedValue({
      personId: 'person',
      authorId: 'A123',
    });
    await service.applyLinks(
      'person',
      [{ type: 'OPENALEX', url: 'https://openalex.org/A123' }],
      db,
    );
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
    client.fetchAuthorWorks.mockResolvedValue([]);
    await service.sync('person', 2);
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
    await service.sync('person', 2);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    const call = prisma.openAlexProfile.updateMany.mock.calls[1] as unknown[];
    expect(call[0]).toMatchObject({ data: { status: 'FAILED' } });
  });
});
