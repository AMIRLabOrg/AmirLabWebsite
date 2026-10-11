import { validateEnvironment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { ExecutionContext } from '@nestjs/common';
import { resolveService } from '../../test/resolve-service';
import { JobsService } from '../jobs/jobs.service';
import { PublicCacheService, PUBLIC_CACHE_JOB } from './public-cache.service';
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
    register: jest.fn<void, [string, () => Promise<void>]>(),
    onSettled: jest.fn<void, [(type: string) => Promise<void>]>(),
    enqueue: jest.fn().mockResolvedValue('retry'),
  };
  const prisma = {
    siteSetting: {
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
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

it('queues durable retry on failed delivery and preserves a committed save if queueing also fails', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
  const { cache, jobs } = await service();
  await cache.invalidate();
  expect(jobs.enqueue).toHaveBeenCalledWith(PUBLIC_CACHE_JOB, {});
  jobs.enqueue.mockRejectedValueOnce(new Error('queue down'));
  await expect(cache.invalidate()).resolves.toBeUndefined();
  const retry = jobs.register.mock.calls[0][1];
  await expect(retry()).rejects.toThrow('503');
});

it('invalidates after public background work, including failed work, but not unrelated or revalidation jobs', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  const { jobs } = await service();
  const settled = jobs.onSettled.mock.calls[0][0];
  for (const type of [
    'DISCOVER_RESEARCH_SOURCE',
    'SYNC_SCHOLAR_PROFILE',
    'RECALCULATE_ALL_RANKS',
  ])
    await settled(type);
  await settled('MAIL');
  await settled(PUBLIC_CACHE_JOB);
  expect(global.fetch).toHaveBeenCalledTimes(3);
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
    type: 'DISCOVER_RESEARCH_SOURCE',
    payload: {},
    attempts: 0,
    maxAttempts: 5,
  };
  const prisma = {
    job: {
      findFirst: jest.fn().mockResolvedValue(job),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest
        .fn<Promise<unknown>, [{ data: { status: string } }]>()
        .mockResolvedValue({}),
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
  expect(prisma.job.update.mock.calls[0][0].data.status).toBe('PENDING');
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
