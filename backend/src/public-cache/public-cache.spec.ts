import { validateEnvironment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { ExecutionContext } from '@nestjs/common';
import { resolveService } from '../../test/resolve-service';
import { JobsService } from '../jobs/jobs.service';
import { PublicCacheService } from './public-cache.service';
import { PublicCacheInterceptor } from './public-cache.interceptor';

const secret = 'a'.repeat(32);
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

async function service(configured = true) {
  const config = {
    get: jest.fn((key: string) =>
      configured
        ? {
            frontendOrigins: [
              'http://127.0.0.1:3000',
              'https://other.example.test',
            ],
            publicCacheRevalidationSecret: secret,
          }[key]
        : undefined,
    ),
  };
  const jobs = {
    register: jest.fn<void, [string, (payload: unknown) => Promise<void>]>(),
    onSettled: jest.fn<void, [(type: string) => Promise<void>]>(),
    enqueue: jest.fn().mockResolvedValue('retry'),
  };
  const prisma = {
    job: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    siteSetting: {
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn((run: (transaction: unknown) => Promise<unknown>) =>
      run({
        job: {
          // Jest mocks expose variadic calls as any.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          upsert: (...args: unknown[]) => prisma.job.upsert(...args),
        },
        siteSetting: {
          // Jest mocks expose variadic calls as any.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          upsert: (...args: unknown[]) => prisma.siteSetting.upsert(...args),
        },
      }),
    ),
  };
  const cache = await resolveService(PublicCacheService, [
    { provide: ConfigService, useValue: config },
    { provide: JobsService, useValue: jobs },
    { provide: PrismaService, useValue: prisma },
  ]);
  cache.onModuleInit();
  return { cache, jobs, prisma };
}

it('delivers immediately to the existing first frontend origin, without queueing or redirects', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  const { cache, jobs } = await service();
  await cache.invalidate();
  expect(global.fetch).toHaveBeenCalledWith(
    'http://127.0.0.1:3000/api/revalidate',
    expect.objectContaining({
      method: 'POST',
      redirect: 'error',
      headers: { authorization: `Bearer ${secret}` },
    }),
  );
  expect(jobs.enqueue).not.toHaveBeenCalled();
});

it('keeps the durable delivery queued when immediate delivery fails', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
  const { cache, jobs, prisma } = await service();
  await cache.invalidate();
  expect(prisma.job.upsert).toHaveBeenCalled();
  expect(prisma.job.deleteMany).not.toHaveBeenCalled();
  const retry = jobs.register.mock.calls[0][1];
  await expect(retry({ revision: 'queued' })).rejects.toThrow('503');
});

it('invalidates after public background work, including failed work, but not unrelated or revalidation jobs', async () => {
  const { jobs } = await service();
  expect(jobs.onSettled).not.toHaveBeenCalled();
});

it('commits revision and durable delivery in the caller transaction', async () => {
  const { cache } = await service(false);
  const transaction = {
    job: { upsert: jest.fn().mockResolvedValue({}) },
    siteSetting: { upsert: jest.fn().mockResolvedValue({}) },
  };

  await cache.invalidateInTransaction(transaction as never, 'openalex:job-1');

  expect(transaction.siteSetting.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ where: { key: 'cache.public.revision' } }),
  );
  expect(transaction.job.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { uniqueKey: 'public-cache:openalex:job-1' },
    }),
  );
});

it('delivery does not replace a newer stored revision', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  const { jobs, prisma } = await service();
  const deliver = jobs.register.mock.calls[0][1];

  await deliver({ revision: 'older-revision' });

  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(prisma.siteSetting.upsert).not.toHaveBeenCalled();
});

it('records a shared revision even when webhook delivery is not configured', async () => {
  global.fetch = jest.fn();
  const { cache, jobs, prisma } = await service(false);
  await cache.invalidate();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(jobs.enqueue).not.toHaveBeenCalled();
  expect(prisma.siteSetting.upsert).toHaveBeenCalledTimes(1);
});

it('reads a shared revision without exposing other settings', async () => {
  const { cache, prisma } = await service(false);
  expect(await cache.revision()).toEqual({ revision: 'initial' });
  prisma.siteSetting.findUnique.mockResolvedValue({ value: 'revision-two' });
  expect(await cache.revision()).toEqual({ revision: 'revision-two' });
});

function context(
  controller: string,
  method: string,
  handler = 'write',
): ExecutionContext {
  return {
    getClass: () => ({ name: controller }),
    getHandler: () => ({ name: handler }),
    switchToHttp: () => ({ getRequest: () => ({ method }) }),
  } as unknown as ExecutionContext;
}

it.each(['review', 'bulkReview'])(
  'advances the shared revision after project %s approval',
  async (handler) => {
    const { cache, prisma } = await service(false);
    const interceptor = await resolveService(PublicCacheInterceptor, [
      { provide: PublicCacheService, useValue: cache },
    ]);
    prisma.siteSetting.upsert.mockImplementation(
      (input: { update: { value: string } }) => {
        prisma.siteSetting.findUnique.mockResolvedValue({
          value: input.update.value,
        });
        return Promise.resolve({});
      },
    );
    expect(await cache.revision()).toEqual({ revision: 'initial' });
    const result = await lastValueFrom(
      interceptor.intercept(
        context('ProjectChangeReviewsController', 'POST', handler),
        { handle: () => of('approved') },
      ),
    );
    expect(result).toBe('approved');
    expect((await cache.revision()).revision).not.toBe('initial');
  },
);

it('expires public writes and partial failures while preserving values and errors', async () => {
  const cache = { invalidate: jest.fn().mockResolvedValue(undefined) };
  const interceptor = await resolveService(PublicCacheInterceptor, [
    { provide: PublicCacheService, useValue: cache },
  ]);
  for (const name of [
    'SiteContentController',
    'ProfilesController',
    'ResearchController',
    'ProjectsController',
    'AdminDepartmentsController',
    'AdminUniversitiesController',
    'UsersController',
    'SettingsController',
    'ApplicationsController',
  ]) {
    await expect(
      lastValueFrom(
        interceptor.intercept(context(name, 'POST'), {
          handle: () => of('saved'),
        }),
      ),
    ).resolves.toBe('saved');
  }
  const error = new Error('post-commit sync failed');
  await expect(
    lastValueFrom(
      interceptor.intercept(context('ProfilesController', 'POST'), {
        handle: () => throwError(() => error),
      }),
    ),
  ).rejects.toBe(error);
  expect(cache.invalidate).toHaveBeenCalledTimes(10);
  await lastValueFrom(
    interceptor.intercept(context('ResearchController', 'GET'), {
      handle: () => of('read'),
    }),
  );
  await lastValueFrom(
    interceptor.intercept(context('CollaborationController', 'POST'), {
      handle: () => of('chat'),
    }),
  );
  expect(cache.invalidate).toHaveBeenCalledTimes(10);
});

it('validates an optional revalidation secret and the existing frontend origin', () => {
  const base = {
    DATABASE_URL: 'postgresql://localhost/test',
    FRONTEND_ORIGINS: 'http://localhost:3000',
  };
  expect(
    validateEnvironment(base).publicCacheRevalidationSecret,
  ).toBeUndefined();
  const settings = {
    ...base,
    PUBLIC_CACHE_REVALIDATION_SECRET: secret,
  };
  expect(validateEnvironment(settings).publicCacheRevalidationSecret).toBe(
    secret,
  );
  expect(() =>
    validateEnvironment({
      ...settings,
      PUBLIC_CACHE_REVALIDATION_SECRET: 'short',
    }),
  ).toThrow('32 characters');
  expect(() =>
    validateEnvironment({
      ...settings,
      FRONTEND_ORIGINS: 'https://user:password@example.test',
    }),
  ).toThrow('FRONTEND_ORIGINS');
});

it('worker notifies settled listeners after a partially failed background handler', async () => {
  const job = {
    id: 'research-job',
    type: 'TEST_COMMITTED_SOURCE',
    payload: {},
    attempts: 0,
    maxAttempts: 5,
  };
  const prisma = {
    job: {
      findFirst: jest.fn().mockResolvedValue(job),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const worker = await resolveService(JobsService, [
    { provide: PrismaService, useValue: prisma },
  ]);
  const settled = jest
    .fn<Promise<void>, [string]>()
    .mockResolvedValue(undefined);
  worker.onSettled(settled);
  worker.register(job.type, () =>
    Promise.reject(new Error('failed after commit')),
  );
  await (worker as unknown as { runNext(): Promise<void> }).runNext();
  expect(settled).toHaveBeenCalledWith(job.type);
  const updateCalls = prisma.job.updateMany.mock.calls as Array<
    [{ data: { status: string } }]
  >;
  expect(updateCalls.some(([input]) => input.data.status === 'PENDING')).toBe(
    true,
  );
});

it('expires public account email changes without invalidating logins or password changes', async () => {
  const cache = { invalidate: jest.fn().mockResolvedValue(undefined) };
  const interceptor = await resolveService(PublicCacheInterceptor, [
    { provide: PublicCacheService, useValue: cache },
  ]);
  for (const handler of [
    'verifyEmailChange',
    'revertEmailChange',
    'login',
    'changePassword',
  ]) {
    await lastValueFrom(
      interceptor.intercept(context('AuthController', 'POST', handler), {
        handle: () => of('ok'),
      }),
    );
  }
  expect(cache.invalidate).toHaveBeenCalledTimes(2);
});
