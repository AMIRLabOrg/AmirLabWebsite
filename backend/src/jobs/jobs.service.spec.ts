import { JobStatus } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { resolveService } from '../../test/resolve-service';
import { DeferredJobError, JobsService } from './jobs.service';

const activeContext = {
  jobId: 'job-id',
  leaseToken: '11111111-1111-4111-8111-111111111111',
  signal: new AbortController().signal,
};

describe('JobsService active deduplication', () => {
  it('returns the existing job while the same work is active', async () => {
    const prisma = {
      job: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'active-job',
          status: JobStatus.RUNNING,
        }),
        updateMany: jest.fn(),
      },
    };
    const service = await resolveService(JobsService, [
      { provide: PrismaService, useValue: prisma },
    ]);

    await expect(
      service.enqueueWhileActive('DISCOVER', { researchItemId: 'item' }, 'key'),
    ).resolves.toBe('active-job');
    expect(prisma.job.create).toHaveBeenCalledTimes(1);
    expect(prisma.job.updateMany).not.toHaveBeenCalled();
  });

  it('releases a completed key before queuing fresh work', async () => {
    const prisma = {
      job: {
        create: jest
          .fn()
          .mockRejectedValueOnce({ code: 'P2002' })
          .mockResolvedValueOnce({ id: 'fresh-job' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'completed-job',
          status: JobStatus.SUCCEEDED,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = await resolveService(JobsService, [
      { provide: PrismaService, useValue: prisma },
    ]);

    await expect(
      service.enqueueWhileActive('DISCOVER', { researchItemId: 'item' }, 'key'),
    ).resolves.toBe('fresh-job');
    expect(prisma.job.updateMany).toHaveBeenCalledWith({
      where: { id: 'completed-job', uniqueKey: 'key' },
      data: { uniqueKey: null },
    });
    expect(prisma.job.create).toHaveBeenCalledTimes(2);
  });

  it('keeps retrying when another enqueue wins key release race', async () => {
    const prisma = {
      job: {
        create: jest
          .fn()
          .mockRejectedValueOnce({ code: 'P2002' })
          .mockRejectedValueOnce({ code: 'P2002' })
          .mockResolvedValueOnce({ id: 'fresh-job' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'completed-job',
          status: JobStatus.SUCCEEDED,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = await resolveService(JobsService, [
      { provide: PrismaService, useValue: prisma },
    ]);

    await expect(
      service.enqueueWhileActive('DISCOVER', { researchItemId: 'item' }, 'key'),
    ).resolves.toBe('fresh-job');
    expect(prisma.job.create).toHaveBeenCalledTimes(3);
    expect(prisma.job.updateMany).toHaveBeenCalledTimes(2);
  });
});

describe('JobsService deferred work', () => {
  it('marks deferred runs failed without scheduling a fast worker retry', async () => {
    const retryAt = new Date('2026-10-14T00:00:00.000Z');
    let jobUpdate: unknown;
    const job = {
      id: 'deferred-job',
      type: 'SYNC_OPENALEX_AUTHOR',
      payload: {},
      attempts: 0,
      maxAttempts: 5,
    };
    const prisma = {
      job: {
        findFirst: jest.fn().mockResolvedValue(job),
        updateMany: jest.fn((input: { data?: { status?: JobStatus } }) => {
          if (input.data?.status === JobStatus.FAILED) jobUpdate = input;
          return Promise.resolve({ count: 1 });
        }),
      },
    };
    const service = await resolveService(JobsService, [
      { provide: PrismaService, useValue: prisma },
    ]);
    service.register('SYNC_OPENALEX_AUTHOR', () =>
      Promise.reject(new DeferredJobError('quota exhausted', retryAt)),
    );

    await (service as unknown as { runNext(): Promise<void> }).runNext();

    expect(jobUpdate).toMatchObject({
      data: {
        status: JobStatus.FAILED,
        runAt: retryAt,
        lastError: 'quota exhausted',
      },
    });
  });
});

describe('JobsService lease fencing and cancellation', () => {
  it('stale_token_cannot_complete', async () => {
    const transaction = {
      job: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = await resolveService(JobsService, [
      { provide: PrismaService, useValue: {} },
    ]);

    await expect(
      service.completeJob(transaction as never, activeContext),
    ).rejects.toThrow('Job lease is no longer active');
  });

  it('cross_instance_cancel_is_observed', async () => {
    const prisma = {
      job: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-id',
          payload: { personId: 'person-id' },
          status: JobStatus.RUNNING,
          type: 'SYNC_OPENALEX_AUTHOR',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = await resolveService(JobsService, [
      { provide: PrismaService, useValue: prisma },
    ]);

    await expect(service.cancel('job-id')).resolves.toBe('aborting');
    expect(prisma.job.updateMany).toHaveBeenCalledWith({
      where: { id: 'job-id', status: JobStatus.RUNNING },
      // Jest asymmetric matchers are intentionally untyped.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: { cancelRequestedAt: expect.any(Date) },
    });
  });

  it('cancel_after_commit_is_not_cancellable', async () => {
    const service = await resolveService(JobsService, [
      {
        provide: PrismaService,
        useValue: {
          job: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'job-id',
              payload: {},
              status: JobStatus.SUCCEEDED,
              type: 'SYNC_OPENALEX_AUTHOR',
            }),
          },
        },
      },
    ]);

    await expect(service.cancel('job-id')).resolves.toBe('not_cancellable');
  });

  it('rejects retries for retired job handlers', async () => {
    const prisma = {
      job: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-id',
          status: JobStatus.FAILED,
          type: 'SYNC_SCHOLAR_PROFILE',
        }),
        updateMany: jest.fn(),
      },
    };
    const service = await resolveService(JobsService, [
      { provide: PrismaService, useValue: prisma },
    ]);

    await expect(service.retry('job-id')).resolves.toBe('not_retryable');
    expect(prisma.job.updateMany).not.toHaveBeenCalled();
  });
});
