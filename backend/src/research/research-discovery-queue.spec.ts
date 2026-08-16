import { Test } from '@nestjs/testing';
import {
  AccountStatus,
  PlatformRole,
  ReviewStatus,
  SourceFetchStatus,
} from '../../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../database/prisma.service';
import { RankingsService } from '../rankings/rankings.service';
import { SettingsService } from '../settings/settings.service';
import { JobsService } from '../jobs/jobs.service';
import { SafeSourceFetcher } from './safe-source-fetcher.service';
import { ResearchDiscoveryService } from './research-discovery.service';
import { ResearchProfileSyncService } from './research-profile-sync.service';
import { ResearchService } from './research.service';

async function createResearchService({
  discovery = {},
  prisma = {},
  profileSync = {
    normalizePublishedOutputs: jest.fn().mockResolvedValue(undefined),
  },
  settings = {},
}: {
  discovery?: object;
  prisma?: object;
  profileSync?: object;
  settings?: object;
}) {
  const prismaValue = Object.assign(
    {
      $transaction: (callback: (transaction: object) => unknown) =>
        Promise.resolve(callback(prisma)),
    },
    prisma,
  );
  const module = await Test.createTestingModule({
    providers: [
      ResearchService,
      { provide: ResearchDiscoveryService, useValue: discovery },
      { provide: NotificationsService, useValue: {} },
      { provide: PrismaService, useValue: prismaValue },
      { provide: ResearchProfileSyncService, useValue: profileSync },
      { provide: RankingsService, useValue: {} },
      { provide: SettingsService, useValue: settings },
    ],
  }).compile();
  return module.get(ResearchService);
}

async function createDiscoveryService({
  jobs = {},
  prisma = {},
}: {
  jobs?: object;
  prisma?: object;
}) {
  const module = await Test.createTestingModule({
    providers: [
      ResearchDiscoveryService,
      { provide: SafeSourceFetcher, useValue: {} },
      { provide: JobsService, useValue: jobs },
      { provide: NotificationsService, useValue: {} },
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get(ResearchDiscoveryService);
}

describe('research source discovery queue', () => {
  it('records pending evidence as soon as a job is queued', async () => {
    const jobs = { enqueueWhileActive: jest.fn().mockResolvedValue('job-id') };
    let upsertInput:
      | {
          create: { status: SourceFetchStatus };
          update: { status: SourceFetchStatus };
        }
      | undefined;
    const upsert = jest.fn(
      (input: NonNullable<typeof upsertInput>): Promise<object> => {
        upsertInput = input;
        return Promise.resolve({});
      },
    );
    const prisma = {
      researchSourceSnapshot: { upsert },
    };
    const service = await createDiscoveryService({ jobs, prisma });

    await expect(
      service.enqueue(
        '0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58',
        'https://example.org/paper',
      ),
    ).resolves.toBe('job-id');
    expect(upsertInput?.create.status).toBe(SourceFetchStatus.PENDING);
    expect(upsertInput?.update.status).toBe(SourceFetchStatus.PENDING);
  });

  it('does not queue another job while source discovery is pending', async () => {
    const discovery = {
      activeJobId: jest.fn().mockResolvedValue('active-job'),
      enqueue: jest.fn(),
    };
    const prisma = {
      researchItem: {
        findUnique: jest.fn().mockResolvedValue({
          canonicalUrl: 'https://example.org/paper',
          id: '0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58',
          sourceSnapshot: { status: SourceFetchStatus.PENDING },
        }),
      },
    };
    const service = await createResearchService({ discovery, prisma });

    await expect(
      service.rediscover('0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58'),
    ).resolves.toEqual({
      deduplicated: true,
      jobId: 'active-job',
      status: SourceFetchStatus.PENDING,
    });
    expect(discovery.enqueue).not.toHaveBeenCalled();
  });

  it('requeues a stale pending snapshot without an active job', async () => {
    const discovery = {
      activeJobId: jest.fn().mockResolvedValue(null),
      enqueue: jest.fn().mockResolvedValue('fresh-job'),
    };
    const prisma = {
      researchItem: {
        findUnique: jest.fn().mockResolvedValue({
          canonicalUrl: 'https://example.org/paper',
          id: '0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58',
          sourceSnapshot: { status: SourceFetchStatus.PENDING },
        }),
      },
    };
    const service = await createResearchService({ discovery, prisma });

    await expect(
      service.rediscover('0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58'),
    ).resolves.toEqual({
      deduplicated: false,
      jobId: 'fresh-job',
      status: SourceFetchStatus.PENDING,
    });
    expect(discovery.enqueue).toHaveBeenCalledTimes(1);
  });

  it('does not publish while canonical source discovery is active', async () => {
    const prisma = {
      researchItem: {
        findUnique: jest.fn().mockResolvedValue({
          contributors: [],
          id: '0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58',
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          sourceSnapshot: { status: SourceFetchStatus.PENDING },
        }),
        update: jest.fn(),
      },
    };
    const service = await createResearchService({ prisma });

    await expect(
      service.review(
        '0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58',
        { status: ReviewStatus.PUBLISHED },
        {
          email: 'admin@example.org',
          id: 'admin-id',
          person: null,
          role: PlatformRole.ADMIN,
          status: AccountStatus.ACTIVE,
        },
      ),
    ).rejects.toThrow('Canonical source discovery is still in progress');
    expect(prisma.researchItem.update).not.toHaveBeenCalled();
  });

  it('does not store a review note when publishing research', async () => {
    let updateInput:
      | {
          data: {
            reviewNote?: string | null;
            reviews?: { create: { note?: string | null } };
          };
        }
      | undefined;
    const prisma = {
      researchItem: {
        findUnique: jest.fn().mockResolvedValue({
          contributors: [],
          id: '0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58',
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          sourceSnapshot: { status: SourceFetchStatus.FETCHED },
          submittedById: null,
          type: 'PAPER',
        }),
        update: jest.fn((input: NonNullable<typeof updateInput>) => {
          updateInput = input;
          return Promise.resolve(input.data);
        }),
      },
    };
    const service = await createResearchService({ prisma });

    await service.review(
      '0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58',
      { note: 'do not store this', status: ReviewStatus.PUBLISHED },
      {
        email: 'admin@example.org',
        id: 'admin-id',
        person: null,
        role: PlatformRole.ADMIN,
        status: AccountStatus.ACTIVE,
      },
    );

    expect(updateInput?.data.reviewNote).toBeNull();
    expect(updateInput?.data.reviews?.create.note).toBeNull();
  });

  it('requires a reviewer note for negative research decisions', async () => {
    const prisma = {
      researchItem: {
        findUnique: jest.fn().mockResolvedValue({
          contributors: [],
          id: '0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58',
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          sourceSnapshot: { status: SourceFetchStatus.FETCHED },
          type: 'PAPER',
        }),
        update: jest.fn(),
      },
    };
    const service = await createResearchService({ prisma });

    await expect(
      service.review(
        '0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58',
        { status: ReviewStatus.REJECTED },
        {
          email: 'admin@example.org',
          id: 'admin-id',
          person: null,
          role: PlatformRole.ADMIN,
          status: AccountStatus.ACTIVE,
        },
      ),
    ).rejects.toThrow('A reviewer note is required');
    expect(prisma.researchItem.update).not.toHaveBeenCalled();
  });
});
