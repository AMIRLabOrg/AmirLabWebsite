import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AccountStatus,
  PlatformRole,
  ProjectMilestoneStatus,
  ProjectStatus,
  ProjectTaskStatus,
  ResearchItemType,
  ReviewStatus,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { accessibleProjectWhere } from '../projects/project-access';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  async overview(user: AuthenticatedUser) {
    const projectWhere = accessibleProjectWhere(user);
    const taskWhere = {
      project: projectWhere,
      status: { not: ProjectTaskStatus.DONE },
    };
    const now = new Date();
    const dueSoonEnd = new Date(now);
    dueSoonEnd.setUTCDate(dueSoonEnd.getUTCDate() + 7);
    const outputWhere = {
      type: { in: [ResearchItemType.PAPER, ResearchItemType.DATASET] },
      ...(user.role !== PlatformRole.MEMBER
        ? { reviewStatus: ReviewStatus.PUBLISHED }
        : { submittedById: user.id }),
    };

    const [
      projects,
      projectCount,
      activeProjectCount,
      assignedTasks,
      assignedTaskCount,
      blockedTasks,
      outputs,
      people,
      departments,
      queues,
      taskHistory,
      overdueAssignedTasks,
      dueSoonAssignedTasks,
      overdueMilestones,
      dueSoonMilestones,
      upcomingMilestones,
    ] = await Promise.all([
      this.prisma.project.findMany({
        where: projectWhere,
        select: {
          researchItemId: true,
          status: true,
          researchItem: {
            select: { title: true, summary: true, updatedAt: true },
          },
          milestones: { select: { progress: true, weight: true } },
          tasks: {
            select: { status: true },
          },
          _count: { select: { memberships: true } },
        },
        orderBy: { researchItem: { updatedAt: 'desc' } },
        take: 6,
      }),
      this.prisma.project.count({ where: projectWhere }),
      this.prisma.project.count({
        where: { ...projectWhere, status: ProjectStatus.ACTIVE },
      }),
      user.role === PlatformRole.MEMBER && user.person
        ? this.prisma.projectTask.findMany({
            where: { ...taskWhere, ownerId: user.person.id },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueAt: true,
              projectId: true,
              project: {
                select: { researchItem: { select: { title: true } } },
              },
            },
            orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
            take: 6,
          })
        : Promise.resolve([]),
      user.role === PlatformRole.MEMBER && user.person
        ? this.prisma.projectTask.count({
            where: { ...taskWhere, ownerId: user.person.id },
          })
        : Promise.resolve(0),
      this.prisma.projectTask.count({
        where: { ...taskWhere, status: ProjectTaskStatus.BLOCKED },
      }),
      this.prisma.researchItem.count({ where: outputWhere }),
      this.prisma.user.count({
        where: {
          status: { in: [AccountStatus.ACTIVE, AccountStatus.PENDING_SETUP] },
        },
      }),
      this.prisma.department.count(),
      this.notifications.workspaceCounts(user),
      this.prisma.projectTask.findMany({
        where: { project: projectWhere },
        select: { status: true, dueAt: true, completedAt: true },
      }),
      user.role === PlatformRole.MEMBER && user.person
        ? this.prisma.projectTask.count({
            where: {
              ...taskWhere,
              ownerId: user.person.id,
              dueAt: { lt: now },
            },
          })
        : Promise.resolve(0),
      user.role === PlatformRole.MEMBER && user.person
        ? this.prisma.projectTask.count({
            where: {
              ...taskWhere,
              ownerId: user.person.id,
              dueAt: { gte: now, lte: dueSoonEnd },
            },
          })
        : Promise.resolve(0),
      this.prisma.projectMilestone.count({
        where: {
          project: projectWhere,
          status: { not: ProjectMilestoneStatus.COMPLETE },
          dueAt: { lt: now },
        },
      }),
      this.prisma.projectMilestone.count({
        where: {
          project: projectWhere,
          status: { not: ProjectMilestoneStatus.COMPLETE },
          dueAt: { gte: now, lte: dueSoonEnd },
        },
      }),
      this.prisma.projectMilestone.findMany({
        where: {
          project: projectWhere,
          status: { not: ProjectMilestoneStatus.COMPLETE },
          dueAt: { not: null },
        },
        select: {
          id: true,
          projectId: true,
          title: true,
          status: true,
          progress: true,
          dueAt: true,
          owner: { select: { fullName: true } },
          project: {
            select: { researchItem: { select: { title: true } } },
          },
        },
        orderBy: { dueAt: 'asc' },
        take: 8,
      }),
    ]);

    const projectCards = projects.map((project) => ({
      id: project.researchItemId,
      title: project.researchItem.title ?? 'Untitled project',
      summary: project.researchItem.summary,
      status: project.status,
      progress: projectProgress(project.milestones),
      memberCount: project._count.memberships,
      openTaskCount: project.tasks.filter(
        ({ status }) => status !== ProjectTaskStatus.DONE,
      ).length,
      blockedTaskCount: project.tasks.filter(
        ({ status }) => status === ProjectTaskStatus.BLOCKED,
      ).length,
    }));

    return {
      attention: queues,
      lab: { departments, people },
      metrics: {
        activeProjects: activeProjectCount,
        assignedTasks: assignedTaskCount,
        blockedTasks,
        overdueTasks: overdueAssignedTasks,
        dueSoonTasks: dueSoonAssignedTasks,
        overdueMilestones,
        dueSoonMilestones,
        outputs,
        projects: projectCount,
      },
      projects: projectCards,
      milestones: upcomingMilestones.map((milestone) => ({
        id: milestone.id,
        projectId: milestone.projectId,
        projectTitle:
          milestone.project.researchItem.title ?? 'Untitled project',
        title: milestone.title,
        status: milestone.status,
        progress: milestone.progress,
        dueAt: milestone.dueAt,
        owner: milestone.owner?.fullName ?? null,
      })),
      taskProgress: weeklyTaskProgress(taskHistory),
      taskStatus: {
        blocked: taskHistory.filter(
          ({ status }) => status === ProjectTaskStatus.BLOCKED,
        ).length,
        done: taskHistory.filter(
          ({ status }) => status === ProjectTaskStatus.DONE,
        ).length,
        inProgress: taskHistory.filter(
          ({ status }) => status === ProjectTaskStatus.IN_PROGRESS,
        ).length,
        todo: taskHistory.filter(
          ({ status }) => status === ProjectTaskStatus.TODO,
        ).length,
      },
      tasks: assignedTasks.map((task) => ({
        id: task.id,
        projectId: task.projectId,
        projectTitle: task.project.researchItem.title ?? 'Untitled project',
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt,
      })),
    };
  }

  async tasks(user: AuthenticatedUser) {
    if (user.role !== PlatformRole.MEMBER) {
      throw new ForbiddenException(
        'Task registers are only available to member accounts',
      );
    }
    if (!user.person) return [];
    return this.prisma.projectTask.findMany({
      where: {
        ownerId: user.person.id,
        project: accessibleProjectWhere(user),
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueAt: true,
        completedAt: true,
        projectId: true,
        project: {
          select: {
            researchItem: { select: { title: true } },
          },
        },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    });
  }
}

function weeklyTaskProgress(
  tasks: Array<{ completedAt: Date | null; dueAt: Date | null }>,
) {
  return recentWeeks(8).map(({ end, start }) => ({
    week: start.toISOString(),
    completed: tasks.filter(
      ({ completedAt }) =>
        completedAt && completedAt >= start && completedAt < end,
    ).length,
    due: tasks.filter(({ dueAt }) => dueAt && dueAt >= start && dueAt < end)
      .length,
  }));
}

function recentWeeks(count: number) {
  const current = new Date();
  const start = new Date(
    Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate(),
    ),
  );
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: count }, (_, index) => {
    const weekStart = new Date(start);
    weekStart.setUTCDate(start.getUTCDate() - (count - index - 1) * 7);
    const end = new Date(weekStart);
    end.setUTCDate(weekStart.getUTCDate() + 7);
    return { end, start: weekStart };
  });
}

function projectProgress(
  milestones: Array<{ progress: number; weight: number }>,
): number {
  return Math.round(
    milestones.reduce(
      (total, milestone) =>
        total + (milestone.weight * milestone.progress) / 100,
      0,
    ),
  );
}
