import {
  AccountStatus,
  PlatformRole,
  ResearchItemType,
  ReviewStatus,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PrismaService } from '../database/prisma.service';
import type { RankingsService } from './rankings.service';
import type { SettingsService } from '../settings/settings.service';
import type { ResearchDiscoveryService } from './research-discovery.service';
import type { ResearchProfileSyncService } from './research-profile-sync.service';
import { ResearchService } from './research.service';
import type { SubmitResearchDto } from './dto/research.dto';
import {
  ResearchLibraryQueryDto,
  ResearchLibraryView,
} from './dto/research-library-query.dto';

function createResearchService({
  discovery,
  notifications,
  prisma,
  settings,
}: {
  discovery: object;
  notifications: object;
  prisma: object;
  settings: object;
}): ResearchService {
  const prismaValue = Object.assign(
    {
      $transaction: (callback: (transaction: object) => unknown) =>
        Promise.resolve(
          callback({
            ...prisma,
            $queryRaw: jest.fn().mockResolvedValue([]),
            researchItem: {
              findFirst: jest.fn().mockResolvedValue(null),
              ...('researchItem' in prisma
                ? (prisma.researchItem as object)
                : {}),
            },
          }),
        ),
    },
    prisma,
  );
  return new ResearchService(
    discovery as ResearchDiscoveryService,
    notifications as NotificationsService,
    prismaValue as PrismaService,
    {} as ResearchProfileSyncService,
    {} as RankingsService,
    settings as SettingsService,
  );
}

function submission(overrides: Partial<SubmitResearchDto> = {}) {
  return {
    canonicalUrl: 'https://example.org/paper',
    contributors: ['Asha Rahman'],
    title: 'A useful paper',
    type: ResearchItemType.PAPER,
    ...overrides,
  } satisfies SubmitResearchDto;
}

it('bounds homepage papers in the published query without changing archive reads', async () => {
  const findMany = jest
    .fn<Promise<unknown[]>, [object]>()
    .mockResolvedValue([]);
  const service = createResearchService({
    discovery: {},
    notifications: {},
    settings: {},
    prisma: { researchItem: { findMany } },
  });
  await service.research(ResearchItemType.PAPER, 3);
  expect(findMany).toHaveBeenLastCalledWith(
    expect.objectContaining({
      take: 3,
      // Jest's asymmetric matchers return any.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: expect.objectContaining({
        type: ResearchItemType.PAPER,
        reviewStatus: ReviewStatus.PUBLISHED,
      }),
      orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
    }),
  );
  await service.research(ResearchItemType.PAPER);
  expect(findMany.mock.calls.at(-1)?.[0]).not.toHaveProperty('take');
  for (const limit of [0, -1, 101, 1.5, NaN]) {
    expect(() => service.research(ResearchItemType.PAPER, limit)).toThrow(
      'limit',
    );
  }
});

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    email: 'admin@example.org',
    id: 'admin-id',
    person: null,
    role: PlatformRole.ADMIN,
    status: AccountStatus.ACTIVE,
    ...overrides,
  };
}

describe('ResearchService.submit provenance and verification', () => {
  it('queues administrator on-behalf submissions before source verification', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'research-item-id',
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      submittedById: 'submitter-user-id',
      title: 'A useful paper',
    });
    const auditCreate = jest.fn().mockResolvedValue({});
    const notifyReviewers = jest.fn().mockResolvedValue(undefined);
    const enqueue = jest.fn().mockResolvedValue('job-id');
    const prisma = {
      auditRecord: { create: auditCreate },
      paper: { create: jest.fn().mockResolvedValue({}) },
      person: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'submitter-person-id',
          userId: 'submitter-user-id',
        }),
      },
      researchItem: {
        create,
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = createResearchService({
      discovery: { enqueue },
      notifications: {
        notifyReviewers,
        publishResearchEvent: jest.fn(),
      },
      prisma,
      settings: {
        verification: jest.fn().mockResolvedValue({
          newDataset: 'MANUAL',
          newPaper: 'AUTOMATIC',
        }),
      },
    });

    const result = await service.submit(
      submission({
        overrideReason: 'Operator requested expedited handling',
        publishNow: true,
        submitterPersonId: 'submitter-person-id',
      }),
      user(),
    );

    expect(result).toMatchObject({
      outcome: 'QUEUED_FOR_REVIEW',
      submittedById: 'submitter-user-id',
    });
    expect(create).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        publishedAt: undefined,
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
        reviewedById: undefined,
        submittedById: 'submitter-user-id',
      }),
    });
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        action: 'research.submitted-on-behalf',
        actorId: 'admin-id',
        details: { submittedForPersonId: 'submitter-person-id' },
        entityId: 'research-item-id',
        entityType: 'ResearchItem',
      },
    });
    expect(notifyReviewers).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      'research-item-id',
      'https://example.org/paper',
    );
  });

  it('queues member automatic submissions for source verification', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'research-item-id',
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      submittedById: 'member-id',
      title: 'A useful paper',
    });
    const auditCreate = jest.fn().mockResolvedValue({});
    const notifyReviewers = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      auditRecord: { create: auditCreate },
      paper: { create: jest.fn().mockResolvedValue({}) },
      person: { findFirst: jest.fn() },
      researchItem: {
        create,
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = createResearchService({
      discovery: { enqueue: jest.fn().mockResolvedValue('job-id') },
      notifications: {
        notifyReviewers,
        publishResearchEvent: jest.fn(),
      },
      prisma,
      settings: {
        verification: jest.fn().mockResolvedValue({
          newDataset: 'MANUAL',
          newPaper: 'AUTOMATIC',
        }),
      },
    });

    const result = await service.submit(
      submission(),
      user({
        id: 'member-id',
        person: {
          avatar: null,
          fullName: 'Member Person',
          id: 'member-person-id',
          isPublished: true,
          rank: null,
          slug: 'member-person',
        },
        role: PlatformRole.MEMBER,
      }),
    );

    expect(result).toMatchObject({
      outcome: 'QUEUED_FOR_REVIEW',
      submittedById: 'member-id',
    });
    expect(create).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
        submittedById: 'member-id',
      }),
    });
    expect(auditCreate).not.toHaveBeenCalled();
    expect(notifyReviewers).toHaveBeenCalledTimes(1);
    expect(prisma.person.findFirst).not.toHaveBeenCalled();
  });

  it('lists only current exact source associations on a person profile', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'accountable-person',
      appointedRank: null,
      contributions: [],
      earnedRank: null,
      fullName: 'Member Person',
      user: null,
    });
    const outputs = ['PAPER', 'DATASET', 'PROJECT'].map((type) => ({
      id: type,
      type,
      contributors: [{ personId: 'another-person' }],
    }));
    const findMany = jest.fn().mockResolvedValue(outputs);
    const service = createResearchService({
      discovery: {},
      notifications: {},
      prisma: { person: { findFirst }, researchItem: { findMany } },
      settings: {},
    });

    const profile = await service.personBySlug('member-person');
    expect(profile.contributions).toEqual(
      outputs.map((researchItem) => ({ researchItem })),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          AND: expect.arrayContaining([
            expect.objectContaining({ reviewStatus: 'PUBLISHED' }),
            {
              people: {
                some: { isCurrent: true, personId: 'accountable-person' },
              },
            },
          ]),
        },
      }),
    );
  });
});

describe('ResearchService API serialization', () => {
  it('omits internal observation versions from review responses', async () => {
    const service = createResearchService({
      discovery: {},
      notifications: {},
      prisma: {
        researchItem: {
          findFirst: jest.fn().mockResolvedValue({
            automationState: 'IDLE',
            automationVersion: 1,
            contributors: [],
            id: 'paper-id',
            reviewStatus: ReviewStatus.NEEDS_REVIEW,
            sourceSnapshot: {
              failureReason: null,
              metadata: null,
              observationVersion: 42n,
              status: 'FETCHED',
            },
            submittedBy: null,
            title: 'Paper',
            type: ResearchItemType.PAPER,
          }),
        },
      },
      settings: {},
    });

    const response = await service.reviewItem('paper-id');

    expect(() => JSON.stringify(response)).not.toThrow();
    expect(response.sourceSnapshot).not.toHaveProperty('observationVersion');
  });
});

describe('ResearchService readonly library', () => {
  it('scopes member results to their current exact associations', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = createResearchService({
      discovery: {},
      notifications: {},
      prisma: { researchItem: { count, findMany } },
      settings: {},
    });
    const member = user({
      person: {
        avatar: null,
        fullName: 'Member',
        id: 'person-id',
        isPublished: true,
        rank: null,
        slug: 'member',
      },
      role: PlatformRole.MEMBER,
    });

    await service.library(new ResearchLibraryQueryDto(), member);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are intentionally untyped.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          AND: expect.arrayContaining([
            expect.objectContaining({
              people: {
                some: { isCurrent: true, personId: 'person-id' },
              },
            }),
          ]),
        }),
      }),
    );
  });

  it('keeps retracted works out of link history and includes them in source issues', async () => {
    const queries: Array<{ where: unknown }> = [];
    const service = createResearchService({
      discovery: {},
      notifications: {},
      settings: {},
      prisma: {
        researchItem: {
          count: jest.fn().mockResolvedValue(0),
          findMany: (query: { where: unknown }) => {
            queries.push(query);
            return Promise.resolve([]);
          },
        },
      },
    });
    const admin = user({ role: PlatformRole.ADMIN });
    await service.library(
      { ...new ResearchLibraryQueryDto(), view: ResearchLibraryView.RETAINED },
      admin,
    );
    await service.library(
      { ...new ResearchLibraryQueryDto(), view: ResearchLibraryView.ISSUES },
      admin,
    );
    expect(JSON.stringify(queries[0].where)).toContain(
      '"reviewStatus":"PUBLISHED"',
    );
    expect(JSON.stringify(queries[1].where)).toContain(
      '"reviewStatus":"ARCHIVED"',
    );
  });

  it('rejects retained and issue views for members', async () => {
    const service = createResearchService({
      discovery: {},
      notifications: {},
      prisma: {},
      settings: {},
    });
    const member = user({
      person: {
        avatar: null,
        fullName: 'Member',
        id: 'person-id',
        isPublished: true,
        rank: null,
        slug: 'member',
      },
      role: PlatformRole.MEMBER,
    });

    await expect(
      service.library(
        Object.assign(new ResearchLibraryQueryDto(), {
          view: ResearchLibraryView.RETAINED,
        }),
        member,
      ),
    ).rejects.toThrow('restricted to staff');
  });

  it('denies a member detail without a current association', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = createResearchService({
      discovery: {},
      notifications: {},
      prisma: { researchItem: { findFirst } },
      settings: {},
    });
    const member = user({
      person: {
        avatar: null,
        fullName: 'Member',
        id: 'person-id',
        isPublished: true,
        rank: null,
        slug: 'member',
      },
      role: PlatformRole.MEMBER,
    });

    await expect(service.libraryItem('item-id', member)).rejects.toThrow(
      'Research output not found',
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are intentionally untyped.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          people: { some: { isCurrent: true, personId: 'person-id' } },
        }),
      }),
    );
  });
});
