import { AcademicRank, JobStatus } from '../../generated/prisma/client';
import { resolveService } from '../../test/resolve-service';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DEFAULT_RANK_POLICY,
  SettingsService,
} from '../settings/settings.service';
import { RankingsService } from './rankings.service';

describe('OpenAlex research ranking', () => {
  it.each([
    [null, null, AcademicRank.LEAD_RESEARCHER],
    ['A123', null, null],
    ['A123', 120, AcademicRank.SENIOR_RESEARCHER],
    ['A123', 600, AcademicRank.LEAD_RESEARCHER],
  ])(
    'ranks 20 papers with author %s and citations %s',
    async (authorId, citationCount, rank) => {
      const person = {
        id: 'person',
        userId: null,
        appointedRank: null,
        earnedRank: null,
        openAlexProfile: authorId ? { authorId, citationCount } : null,
      };
      const update = jest.fn().mockResolvedValue({});
      const audit = jest.fn().mockResolvedValue({});
      const transaction = {
        personMetric: { upsert: jest.fn().mockResolvedValue({}) },
        person: { findMany: jest.fn().mockResolvedValue([person]), update },
        auditRecord: { create: audit, createMany: audit },
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest
          .fn()
          .mockResolvedValue([{ personId: 'person', paperCount: 20 }]),
      };
      const prisma = {
        person: {
          findUnique: jest.fn().mockResolvedValue(person),
          findMany: jest.fn().mockResolvedValue([person]),
        },
        researchItem: { count: jest.fn().mockResolvedValue(20) },
        $queryRaw: jest
          .fn()
          .mockResolvedValue([{ personId: 'person', paperCount: 20 }]),
        $transaction: (run: (db: typeof transaction) => Promise<unknown>) =>
          run(transaction),
      };
      const service = await resolveService(RankingsService, [
        { provide: JobsService, useValue: {} },
        { provide: NotificationsService, useValue: { createMany: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        {
          provide: SettingsService,
          useValue: { ranking: () => Promise.resolve(DEFAULT_RANK_POLICY) },
        },
      ]);
      await service.recalculate('person');
      const call = update.mock.calls[0] as unknown[];
      expect(call[0]).toMatchObject({ data: { earnedRank: rank } });
      audit.mockClear();
      await service.recalculateMany(['person']);
      const bulkCall = audit.mock.calls[0] as unknown[];
      expect(bulkCall[0]).toMatchObject({
        data: [{ details: { earnedRank: { to: rank } } }],
      });
    },
  );

  it('retires pending Scholar jobs without registering a scraper', async () => {
    const register = jest.fn();
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = await resolveService(RankingsService, [
      { provide: JobsService, useValue: { register } },
      { provide: NotificationsService, useValue: {} },
      { provide: PrismaService, useValue: { job: { updateMany } } },
      { provide: SettingsService, useValue: {} },
    ]);
    await service.onModuleInit();
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      'RECALCULATE_ALL_RANKS',
      expect.any(Function),
    );
    const call = updateMany.mock.calls[0] as unknown[];
    expect(call[0]).toMatchObject({
      where: { type: 'SYNC_SCHOLAR_PROFILE' },
      data: { status: JobStatus.CANCELLED },
    });
  });

  it('uses the caller transaction for rank writes and notification jobs', async () => {
    const person = {
      appointedRank: null,
      earnedRank: null,
      id: 'person',
      openAlexProfile: { authorId: 'A1', citationCount: 20 },
      userId: 'user',
    };
    const transaction = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ personId: 'person', paperCount: 5 }]),
      auditRecord: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      person: { findMany: jest.fn().mockResolvedValue([person]) },
    };
    const prisma = { $transaction: jest.fn() };
    const notifications = {
      createMany: jest.fn().mockResolvedValue(undefined),
    };
    const service = await resolveService(RankingsService, [
      { provide: JobsService, useValue: {} },
      { provide: NotificationsService, useValue: notifications },
      { provide: PrismaService, useValue: prisma },
      {
        provide: SettingsService,
        useValue: { ranking: () => Promise.resolve(DEFAULT_RANK_POLICY) },
      },
    ]);

    await service.recalculateMany(['person'], 'actor', transaction as never);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transaction.person.findMany).toHaveBeenCalled();
    expect(transaction.$queryRaw).toHaveBeenCalled();
    expect(notifications.createMany).toHaveBeenCalledWith(
      expect.any(Array),
      transaction,
    );
  });
});
