jest.mock('../../generated/prisma/client', () => ({
  AccountStatus: { ACTIVE: 'ACTIVE', PENDING_SETUP: 'PENDING_SETUP' },
  PlatformRole: { ADMIN: 'ADMIN', MEMBER: 'MEMBER', MODERATOR: 'MODERATOR' },
  PrismaClient: class PrismaClient {},
  ProjectMembershipStatus: { ACTIVE: 'ACTIVE' },
  ProjectStatus: { ACTIVE: 'ACTIVE' },
  ProjectTaskStatus: { BLOCKED: 'BLOCKED', DONE: 'DONE' },
  ResearchItemType: { DATASET: 'DATASET', PAPER: 'PAPER' },
  ReviewStatus: { PUBLISHED: 'PUBLISHED' },
}));

import { WorkspaceService } from './workspace.service';

describe('WorkspaceService overview', () => {
  const prisma = {
    department: { count: jest.fn() },
    project: { count: jest.fn(), findMany: jest.fn() },
    projectTask: { count: jest.fn(), findMany: jest.fn() },
    researchItem: { count: jest.fn() },
    user: { count: jest.fn() },
  };
  const notifications = { workspaceCounts: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.project.findMany.mockResolvedValue([
      {
        researchItemId: 'project-id',
        status: 'ACTIVE',
        researchItem: {
          title: 'Medical vision model',
          summary: 'Build a lightweight diagnostic model.',
          updatedAt: new Date('2026-07-28T00:00:00Z'),
        },
        milestones: [{ progress: 50, weight: 100 }],
        tasks: [{ status: 'IN_PROGRESS' }, { status: 'BLOCKED' }],
        _count: { memberships: 3 },
      },
    ]);
    prisma.projectTask.findMany.mockResolvedValue([
      {
        id: 'task-id',
        title: 'Validate baseline',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueAt: new Date('2026-08-01T00:00:00Z'),
        projectId: 'project-id',
        project: { researchItem: { title: 'Medical vision model' } },
      },
    ]);
    prisma.projectTask.count.mockResolvedValue(1);
    prisma.project.count.mockResolvedValue(1);
    prisma.researchItem.count.mockResolvedValue(2);
    prisma.user.count.mockResolvedValue(12);
    prisma.department.count.mockResolvedValue(3);
    notifications.workspaceCounts.mockResolvedValue({
      applications: 0,
      profileReviews: 0,
      projectReviews: 0,
      researchReviews: 0,
      unreadCount: 2,
    });
  });

  it('returns member work from active project memberships', async () => {
    const service = new WorkspaceService(
      notifications as never,
      prisma as never,
    );

    const result = await service.overview({
      id: 'user-id',
      email: 'member@amirl.local',
      role: 'MEMBER' as never,
      status: 'ACTIVE' as never,
      person: {
        id: 'person-id',
        fullName: 'Member',
        isPublished: true,
        rank: null,
        slug: 'member',
        avatar: null,
      },
    });

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberships: {
            some: { personId: 'person-id', status: 'ACTIVE' },
          },
        },
      }),
    );
    expect(prisma.researchItem.count).toHaveBeenCalledWith({
      where: {
        submittedById: 'user-id',
        type: { in: ['PAPER', 'DATASET'] },
      },
    });
    expect(result.metrics).toEqual({
      activeProjects: 1,
      assignedTasks: 1,
      blockedTasks: 1,
      outputs: 2,
      projects: 1,
    });
    expect(result.projects[0]).toMatchObject({
      blockedTaskCount: 1,
      openTaskCount: 2,
      progress: 50,
    });
  });

  it('uses the full portfolio and published outputs for administrators', async () => {
    const service = new WorkspaceService(
      notifications as never,
      prisma as never,
    );

    await service.overview({
      id: 'admin-id',
      email: 'admin@amirl.local',
      role: 'ADMIN' as never,
      status: 'ACTIVE' as never,
      person: null,
    });

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(prisma.projectTask.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.projectTask.findMany).toHaveBeenCalledWith({
      select: { completedAt: true, dueAt: true, status: true },
      where: { project: {} },
    });
    expect(prisma.researchItem.count).toHaveBeenCalledWith({
      where: {
        reviewStatus: 'PUBLISHED',
        type: { in: ['PAPER', 'DATASET'] },
      },
    });
  });
});
