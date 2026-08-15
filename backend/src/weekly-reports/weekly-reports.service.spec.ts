import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { WeeklyReportStatus } from '../../generated/prisma/client';
import {
  WeeklyReportsService,
  currentWeekStart,
} from './weekly-reports.service';

describe('WeeklyReportsService', () => {
  const prisma = {
    $transaction: jest.fn(),
    auditRecord: { create: jest.fn() },
    project: { count: jest.fn(), findMany: jest.fn() },
    researchItem: { count: jest.fn(), findMany: jest.fn() },
    weeklyReport: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    weeklyReportProject: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    weeklyReportOutput: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const notifications = {
    create: jest.fn(),
    notifyReviewers: jest.fn(),
  };
  const member = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'member@amirl.local',
    role: 'MEMBER' as never,
    status: 'ACTIVE' as never,
    person: {
      id: '22222222-2222-4222-8222-222222222222',
      fullName: 'Lab Member',
      isPublished: true,
      rank: null,
      slug: 'lab-member',
      avatar: null,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((work) => work(prisma));
  });

  it('builds current-week evidence only from accessible project tasks', async () => {
    prisma.weeklyReport.findUnique.mockResolvedValue(null);
    prisma.researchItem.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([
      {
        researchItemId: '33333333-3333-4333-8333-333333333333',
        researchItem: { title: 'Medical vision model' },
        tasks: [
          {
            completedAt: new Date('2026-07-28T10:00:00Z'),
            dueAt: new Date('2026-07-30T10:00:00Z'),
            status: 'DONE',
          },
          { completedAt: null, dueAt: null, status: 'IN_PROGRESS' },
        ],
      },
    ]);
    const service = new WeeklyReportsService(
      notifications as never,
      prisma as never,
    );

    const result = await service.current(member);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberships: {
            some: { personId: member.person.id, status: 'ACTIVE' },
          },
        },
      }),
    );
    expect(result.projects[0].tasks).toEqual({ completed: 1, due: 1, open: 1 });
    expect(result.outputs).toEqual([]);
  });

  it('rejects personal weekly-report access for staff accounts', async () => {
    const service = new WeeklyReportsService(
      notifications as never,
      prisma as never,
    );
    const moderator = {
      ...member,
      id: '66666666-6666-4666-8666-666666666666',
      role: 'MODERATOR' as never,
    };

    await expect(service.current(moderator)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(() => service.mine(moderator)).toThrow(ForbiddenException);
    await expect(service.submit(moderator)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects projects outside the author access scope', async () => {
    prisma.project.count.mockResolvedValue(0);
    const service = new WeeklyReportsService(
      notifications as never,
      prisma as never,
    );

    await expect(
      service.save(
        {
          accomplishments: 'Completed the baseline evaluation.',
          blockers: '',
          nextWeekPlan: 'Run the ablation study.',
          projectIds: ['33333333-3333-4333-8333-333333333333'],
        },
        member,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires actionable guidance when changes are requested', async () => {
    prisma.weeklyReport.findUnique.mockResolvedValue({
      authorId: member.id,
      status: WeeklyReportStatus.SUBMITTED,
    });
    const service = new WeeklyReportsService(
      notifications as never,
      prisma as never,
    );

    await expect(
      service.review(
        '44444444-4444-4444-8444-444444444444',
        { status: WeeklyReportStatus.CHANGES_REQUESTED },
        {
          ...member,
          id: '55555555-5555-4555-8555-555555555555',
          role: 'MODERATOR' as never,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('currentWeekStart', () => {
  it('uses Monday as the reporting boundary', () => {
    expect(
      currentWeekStart(new Date('2026-07-28T19:00:00Z')).toISOString(),
    ).toBe('2026-07-27T00:00:00.000Z');
  });
});
