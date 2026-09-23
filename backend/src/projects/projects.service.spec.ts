import {
  PlatformRole,
  Prisma,
  ProjectAccess,
  ProjectChangeKind,
  ProjectChangeStatus,
  ReviewStatus,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ProjectsService } from './projects.service';

describe('ProjectsService project review policy', () => {
  type ServiceHarness = {
    applyOrQueue: (
      projectId: string,
      kind: ProjectChangeKind,
      input: Record<string, unknown>,
      user: AuthenticatedUser,
    ) => Promise<{
      outcome: 'APPLIED' | 'QUEUED_FOR_REVIEW';
      direct: boolean;
      result?: unknown;
      request?: unknown;
    }>;
    review: ProjectsService['review'];
    bulkReview: jest.Mock;
    applyChange: jest.Mock;
    unarchive: ProjectsService['unarchive'];
    authorize: (
      projectId: string,
      user: AuthenticatedUser,
      required: ProjectAccess,
      reviewersMayView?: boolean,
      allowArchived?: boolean,
    ) => Promise<void>;
    settings: { verification: jest.Mock };
    notifications: { notifyReviewers: jest.Mock };
    prisma: {
      projectChangeRequest: { create: jest.Mock };
      auditRecord: { create: jest.Mock };
      $transaction: jest.Mock;
    };
    project: jest.Mock;
  };

  let service: ServiceHarness;

  beforeEach(() => {
    const transactionClient = {
      project: { update: jest.fn().mockResolvedValue({ version: 4 }) },
      researchItem: {
        update: jest.fn().mockResolvedValue({
          reviewStatus: ReviewStatus.VERIFIED,
        }),
      },
    } as unknown as Prisma.TransactionClient;
    service = Object.assign(Object.create(ProjectsService.prototype), {
      settings: {
        verification: jest.fn().mockResolvedValue({
          archiveProject: 'MANUAL',
          updateProject: 'MANUAL',
        }),
      },
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue({
            researchItem: { reviewStatus: ReviewStatus.ARCHIVED },
          }),
        },
        projectChangeRequest: {
          create: jest.fn().mockResolvedValue({ id: 'request-1' }),
        },
        auditRecord: { create: jest.fn().mockResolvedValue({}) },
        $transaction: jest.fn(
          (run: (transaction: Prisma.TransactionClient) => Promise<unknown>) =>
            run(transactionClient),
        ),
      },
      notifications: { notifyReviewers: jest.fn() },
      bulkReview: jest.fn().mockResolvedValue({ count: 1 }),
      applyChange: jest.fn().mockResolvedValue({ archived: true }),
      project: jest.fn().mockResolvedValue({
        version: 3,
        researchItem: {
          reviewStatus: ReviewStatus.ARCHIVED,
          title: 'Test project',
        },
      }),
    }) as ServiceHarness;
  });

  it('applies administrator archive changes directly under manual policy', async () => {
    const admin = {
      id: 'admin-1',
      role: PlatformRole.ADMIN,
    } as AuthenticatedUser;

    const result = await service.applyOrQueue(
      'project-1',
      ProjectChangeKind.ARCHIVE,
      {},
      admin,
    );

    expect(result).toEqual({
      outcome: 'APPLIED',
      direct: true,
      result: { archived: true },
    });
    expect(service.applyChange).toHaveBeenCalledWith(
      'project-1',
      ProjectChangeKind.ARCHIVE,
      {},
      'admin-1',
    );
    expect(service.prisma.projectChangeRequest.create).not.toHaveBeenCalled();
  });

  it('queues non-admin project changes under manual policy', async () => {
    const member = {
      id: 'member-1',
      role: PlatformRole.MEMBER,
    } as AuthenticatedUser;

    const result = await service.applyOrQueue(
      'project-1',
      ProjectChangeKind.ARCHIVE,
      {},
      member,
    );

    expect(result).toEqual({
      outcome: 'QUEUED_FOR_REVIEW',
      direct: false,
      request: { id: 'request-1' },
    });
    expect(service.applyChange).not.toHaveBeenCalled();
    expect(service.prisma.projectChangeRequest.create).toHaveBeenCalledWith({
      data: {
        baseVersion: 3,
        kind: ProjectChangeKind.ARCHIVE,
        payload: {},
        projectId: 'project-1',
        submittedById: 'member-1',
      },
    });
    expect(service.notifications.notifyReviewers).toHaveBeenCalledTimes(1);
  });

  it('queues non-admin archive when edits are automatic but archive is manual', async () => {
    const member = {
      id: 'member-1',
      role: PlatformRole.MEMBER,
    } as AuthenticatedUser;
    service.settings.verification.mockResolvedValue({
      archiveProject: 'MANUAL',
      updateProject: 'AUTOMATIC',
    });

    const result = await service.applyOrQueue(
      'project-1',
      ProjectChangeKind.ARCHIVE,
      {},
      member,
    );

    expect(result).toEqual({
      outcome: 'QUEUED_FOR_REVIEW',
      direct: false,
      request: { id: 'request-1' },
    });
    expect(service.applyChange).not.toHaveBeenCalled();
    expect(service.prisma.projectChangeRequest.create).toHaveBeenCalled();
  });

  it('applies non-admin project edits directly when edits are automatic', async () => {
    const member = {
      id: 'member-1',
      role: PlatformRole.MEMBER,
    } as AuthenticatedUser;
    service.settings.verification.mockResolvedValue({
      archiveProject: 'MANUAL',
      updateProject: 'AUTOMATIC',
    });

    const result = await service.applyOrQueue(
      'project-1',
      ProjectChangeKind.DETAILS,
      {},
      member,
    );

    expect(result).toEqual({
      outcome: 'APPLIED',
      direct: true,
      result: { archived: true },
    });
    expect(service.applyChange).toHaveBeenCalledWith(
      'project-1',
      ProjectChangeKind.DETAILS,
      {},
      'member-1',
    );
    expect(service.prisma.projectChangeRequest.create).not.toHaveBeenCalled();
  });

  it('routes single decisions through the concurrency-safe bulk path', async () => {
    const reviewer = {
      id: 'admin-1',
      role: PlatformRole.ADMIN,
    } as AuthenticatedUser;
    const decision = { status: ProjectChangeStatus.APPROVED };

    const result = await service.review('request-1', decision, reviewer);

    expect(service.bulkReview).toHaveBeenCalledWith(
      { ...decision, ids: ['request-1'] },
      reviewer,
    );
    expect(result).toEqual({ status: ProjectChangeStatus.APPROVED });
  });

  it('unarchives a project as verified while keeping the public page disabled', async () => {
    const admin = {
      id: 'admin-1',
      role: PlatformRole.ADMIN,
    } as AuthenticatedUser;

    const result = await service.unarchive('project-1', admin);

    expect(result).toMatchObject({ outcome: 'APPLIED', direct: true });
    expect(service.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(service.prisma.auditRecord.create).toHaveBeenCalledWith({
      data: {
        action: 'project.unarchived',
        actorId: 'admin-1',
        entityId: 'project-1',
        entityType: 'Project',
        details: { restoredReviewStatus: ReviewStatus.VERIFIED },
      },
    });
  });

  it('blocks administrator edits while the project is archived', async () => {
    const admin = {
      id: 'admin-1',
      role: PlatformRole.ADMIN,
    } as AuthenticatedUser;

    await expect(
      service.authorize('project-1', admin, ProjectAccess.MANAGE),
    ).rejects.toThrow(
      'This project is archived and read-only. Unarchive it before editing.',
    );
  });
});
