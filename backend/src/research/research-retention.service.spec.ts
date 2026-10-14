import { ConflictException } from '@nestjs/common';
import { resolveService } from '../../test/resolve-service';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { PublicCacheService } from '../public-cache/public-cache.service';
import { ResearchRetentionService } from './research-retention.service';

describe('research output retention', () => {
  function setup(overrides: Record<string, unknown> = {}) {
    let handler:
      ((payload: never, context: never) => Promise<void>) | undefined;
    const transaction = {
      $queryRaw: jest.fn(),
      auditRecord: { create: jest.fn() },
      job: { upsert: jest.fn() },
      person: {
        delete: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          id: 'person',
          userId: 'user',
          user: { deletedAt: null, isDeleted: false, role: 'MEMBER' },
        }),
      },
      personResearchItem: {
        findMany: jest.fn().mockResolvedValue([{ researchItemId: 'output' }]),
      },
      projectMembership: { count: jest.fn().mockResolvedValue(0) },
      researchProgram: { count: jest.fn().mockResolvedValue(0) },
      session: { updateMany: jest.fn() },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ role: 'MEMBER', isDeleted: false }),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn(),
      },
      ...overrides,
    };
    const prisma = {
      $transaction: jest.fn((run: (tx: typeof transaction) => unknown) =>
        run(transaction),
      ),
    };
    const jobs = {
      register: jest.fn(
        (_type: string, value: typeof handler) => (handler = value),
      ),
    };
    const publicCache = { invalidateInTransaction: jest.fn() };
    return resolveService(ResearchRetentionService, [
      { provide: JobsService, useValue: jobs },
      { provide: PrismaService, useValue: prisma },
      { provide: PublicCacheService, useValue: publicCache },
    ]).then((service) => ({
      handler: () => handler,
      jobs,
      prisma,
      publicCache,
      service,
      transaction,
    }));
  }

  it('removes the person, trashes the account and queues targeted cleanup atomically', async () => {
    const { service, transaction } = await setup();
    await expect(service.removePerson('person', 'actor')).resolves.toEqual({
      removed: true,
    });
    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are intentionally untyped.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ isDeleted: true, status: 'ARCHIVED' }),
      }),
    );
    expect(transaction.person.delete).toHaveBeenCalledWith({
      where: { id: 'person' },
    });
    expect(transaction.job.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are intentionally untyped.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        create: expect.objectContaining({
          payload: { outputIds: ['output'] },
          type: 'CLEANUP_RESEARCH_OUTPUTS',
        }),
      }),
    );
  });

  it('requires active ownership to be reassigned', async () => {
    const { service, transaction } = await setup();
    transaction.projectMembership.count.mockResolvedValue(1);
    await expect(service.removePerson('person', 'actor')).rejects.toThrow(
      ConflictException,
    );
    expect(transaction.person.delete).not.toHaveBeenCalled();
  });

  it('shares the account guard when removing the last administrator profile', async () => {
    const { service, transaction } = await setup();
    transaction.user.findUnique.mockResolvedValue({
      role: 'ADMIN',
      isDeleted: false,
    });
    transaction.user.count.mockResolvedValue(0);
    await expect(service.removePerson('person', 'actor')).rejects.toThrow(
      'last administrator',
    );
    expect(transaction.person.delete).not.toHaveBeenCalled();
    expect(transaction.user.update).not.toHaveBeenCalled();
  });
});
