import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { JobStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { Environment } from '../config/environment';
import { runWithJobContext, type JobContext } from './job-context';

type JobHandler = (
  payload: Prisma.JsonValue,
  context: JobContext,
) => Promise<void>;
type JobCancelHandler = (payload: Prisma.JsonValue) => Promise<void>;

export type JobChangeKind =
  'created' | 'started' | 'succeeded' | 'failed' | 'cancelled' | 'retried';

export interface JobChange {
  jobId: string;
  type: string;
  status: JobStatus;
  kind: JobChangeKind;
}

export interface JobListView {
  id: string;
  type: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  subject: string | null;
  lastError: string | null;
  runAt: Date;
  lockedAt: Date | null;
  completedAt: Date | null;
  cancelRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobListQuery {
  status?: JobStatus;
  type?: string;
  page: number;
  pageSize: number;
}

interface ClaimedJob {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
  leaseToken: string;
}

export class DeferredJobError extends Error {
  constructor(
    message: string,
    readonly retryAt: Date,
  ) {
    super(message);
  }
}

export class JobLeaseLostError extends Error {
  constructor() {
    super('Job lease is no longer active');
  }
}

const HEARTBEAT_MS = 15_000;
const LEASE_MS = 90_000;
const RECOVERY_MS = 30_000;
const SOURCE_DEADLINE_MS = 5 * 60_000;
const PRIORITY_TYPES = ['SEND_EMAIL', 'WEB_PUSH'] as const;
const RETIRED_TYPES = ['DISCOVER_RESEARCH_SOURCE', 'SYNC_SCHOLAR_PROFILE'];

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly settledListeners: Array<(type: string) => Promise<void>> =
    [];
  private readonly changeListeners: Array<(change: JobChange) => void> = [];
  private readonly handlers = new Map<string, JobHandler>();
  private readonly cancelHandlers = new Map<string, JobCancelHandler>();
  private readonly running = new Map<
    string,
    { controller: AbortController; type: string; payload: Prisma.JsonValue }
  >();
  private readonly logger = new Logger(JobsService.name);
  private readonly workerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private recoveryTimer?: NodeJS.Timeout;
  private dispatching = false;
  private readonly concurrency: number;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() config?: ConfigService<Environment, true>,
  ) {
    this.concurrency = config?.get('jobConcurrency', { infer: true }) ?? 8;
  }

  async onModuleInit(): Promise<void> {
    await this.recoverExpired();
    await this.prisma.job.updateMany({
      where: { type: { in: RETIRED_TYPES }, status: JobStatus.PENDING },
      data: {
        status: JobStatus.CANCELLED,
        completedAt: new Date(),
        lastError: 'Retired: research outputs now use OpenAlex author sync.',
      },
    });
    this.timer = setInterval(() => void this.dispatch(), 2_000);
    this.recoveryTimer = setInterval(
      () => void this.recoverExpired().then(() => this.dispatch()),
      RECOVERY_MS,
    );
    this.cleanupTimer = setInterval(
      () => void this.purgeDeletedUsers(),
      60 * 60_000,
    );
    await this.purgeDeletedUsers();
    await this.dispatch();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
    }
    for (const { controller } of this.running.values()) controller.abort();
  }

  private async purgeDeletedUsers(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const accounts = await this.prisma.user.findMany({
      where: { deletedAt: { lte: cutoff }, isDeleted: true },
      select: { id: true },
    });
    for (const account of accounts) {
      try {
        await this.prisma.user.delete({ where: { id: account.id } });
        await this.notifySettled('PURGE_DELETED_USERS');
      } catch (error) {
        if (isForeignKeyConstraintError(error)) {
          this.logger.warn(
            `Deleted account ${account.id} is retained because it still owns records`,
          );
          continue;
        }
        throw error;
      }
    }
  }

  private async notifySettled(type: string): Promise<void> {
    for (const listener of this.settledListeners) {
      await listener(type).catch((error: unknown) => {
        this.logger.error(
          `Job completion listener failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }
  }

  private emit(change: JobChange): void {
    for (const listener of this.changeListeners) {
      try {
        listener(change);
      } catch (error) {
        this.logger.error(
          `Job change listener failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  onSettled(listener: (type: string) => Promise<void>): void {
    this.settledListeners.push(listener);
  }

  onChange(listener: (change: JobChange) => void): void {
    this.changeListeners.push(listener);
  }

  register(type: string, handler: JobHandler): void {
    if (RETIRED_TYPES.includes(type)) return;
    if (this.handlers.has(type)) {
      throw new Error(`Job handler already registered for ${type}`);
    }
    this.handlers.set(type, handler);
  }

  async assertActiveJob(
    transaction: Prisma.TransactionClient,
    context: JobContext,
  ): Promise<void> {
    if (context.deadlineAt && context.deadlineAt <= new Date()) {
      throw new JobLeaseLostError();
    }
    const job = await transaction.job.findFirst({
      where: activeLeaseWhere(context),
      select: { id: true },
    });
    if (!job) throw new JobLeaseLostError();
  }

  async completeJob(
    transaction: Prisma.TransactionClient,
    context: JobContext,
  ): Promise<void> {
    if (context.deadlineAt && context.deadlineAt <= new Date()) {
      throw new JobLeaseLostError();
    }
    const completed = await transaction.job.updateMany({
      where: activeLeaseWhere(context),
      data: {
        completedAt: new Date(),
        lastError: null,
        leaseExpiresAt: null,
        leaseToken: null,
        lockedAt: null,
        lockedBy: null,
        status: JobStatus.SUCCEEDED,
        uniqueKey: null,
      },
    });
    if (completed.count === 0) throw new JobLeaseLostError();
  }

  registerCancelHandler(type: string, handler: JobCancelHandler): void {
    if (this.cancelHandlers.has(type)) {
      throw new Error(`Job cancel handler already registered for ${type}`);
    }
    this.cancelHandlers.set(type, handler);
  }

  private async runCancelHandlers(
    type: string,
    payload: Prisma.JsonValue,
  ): Promise<void> {
    const handler = this.cancelHandlers.get(type);
    if (!handler) return;
    await handler(payload).catch((error: unknown) => {
      this.logger.error(
        `Job cancel handler for ${type} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  async enqueue(
    type: string,
    payload: Prisma.InputJsonValue,
    uniqueKey?: string,
    runAt?: Date,
  ): Promise<string> {
    if (RETIRED_TYPES.includes(type))
      throw new Error('Research outputs now use OpenAlex author sync');
    const job = await this.prisma.job.create({
      data: { type, payload, uniqueKey, runAt },
      select: { id: true },
    });
    this.emit({
      jobId: job.id,
      type,
      status: JobStatus.PENDING,
      kind: 'created',
    });
    return job.id;
  }

  async enqueueWhileActive(
    type: string,
    payload: Prisma.InputJsonValue,
    uniqueKey: string,
    runAt?: Date,
  ): Promise<string> {
    for (;;) {
      try {
        return await this.enqueue(type, payload, uniqueKey, runAt);
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;

        const existing = await this.prisma.job.findUnique({
          where: { uniqueKey },
          select: { id: true, status: true },
        });
        if (!existing) continue;
        if (
          existing.status === JobStatus.PENDING ||
          existing.status === JobStatus.RUNNING
        ) {
          return existing.id;
        }

        await this.prisma.job.updateMany({
          where: { id: existing.id, uniqueKey },
          data: { uniqueKey: null },
        });
      }
    }
  }

  async activeJobId(uniqueKey: string): Promise<string | null> {
    const job = await this.prisma.job.findUnique({
      where: { uniqueKey },
      select: { id: true, status: true },
    });
    return job?.status === JobStatus.PENDING ||
      job?.status === JobStatus.RUNNING
      ? job.id
      : null;
  }

  async list(query: JobListQuery) {
    const where: Prisma.JobWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: [{ runAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.job.count({ where }),
    ]);
    return {
      items: items.map(toJobView),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async summary() {
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const now = new Date();
    const [
      pending,
      expiredLeases,
      staleProfiles,
      neverSyncedProfiles,
      deliveryFailure,
      outputConflicts,
    ] = await Promise.all([
      this.prisma.job.aggregate({
        where: { status: JobStatus.PENDING },
        _min: { createdAt: true },
      }),
      this.prisma.job.count({
        where: { status: JobStatus.RUNNING, leaseExpiresAt: { lt: now } },
      }),
      this.prisma.openAlexProfile.count({
        where: { syncedAt: { lt: new Date(now.getTime() - 48 * 60 * 60_000) } },
      }),
      this.prisma.openAlexProfile.count({ where: { syncedAt: null } }),
      this.prisma.job.aggregate({
        where: {
          status: JobStatus.FAILED,
          type: {
            in: [
              'SEND_EMAIL',
              'WEB_PUSH',
              'SEND_ISSUED_DOCUMENT',
              'SEND_APPLICATION_REJECTION',
            ],
          },
        },
        _min: { updatedAt: true },
      }),
      this.prisma.researchItem.count({
        where: {
          sourceSnapshot: { failureReason: { not: null } },
          type: { in: ['PAPER', 'DATASET'] },
        },
      }),
    ]);
    const [byStatus, byType, succeeded24h, failed24h] = await Promise.all([
      this.prisma.job.groupBy({ by: ['status'], _count: true }),
      this.prisma.job.groupBy({ by: ['type', 'status'], _count: true }),
      this.prisma.job.count({
        where: { status: JobStatus.SUCCEEDED, completedAt: { gte: since } },
      }),
      this.prisma.job.count({
        where: {
          status: JobStatus.FAILED,
          updatedAt: { gte: since },
        },
      }),
    ]);
    const statuses: Record<string, number> = {
      PENDING: 0,
      RUNNING: 0,
      SUCCEEDED: 0,
      FAILED: 0,
      CANCELLED: 0,
    };
    for (const row of byStatus) statuses[row.status] = row._count;
    return {
      statuses,
      registeredTypes: [...this.handlers.keys()].sort(),
      types: byType.map((row) => ({
        type: row.type,
        status: row.status,
        count: row._count,
      })),
      succeeded24h,
      failed24h,
      health: {
        oldestPendingSeconds: pending._min.createdAt
          ? Math.floor(
              (now.getTime() - pending._min.createdAt.getTime()) / 1000,
            )
          : null,
        expiredLeases,
        staleProfiles,
        neverSyncedProfiles,
        oldestDeliveryFailureAt: deliveryFailure._min.updatedAt,
        outputConflicts,
      },
    };
  }

  async cancel(
    jobId: string,
  ): Promise<'cancelled' | 'aborting' | 'not_found' | 'not_cancellable'> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, type: true, status: true, payload: true },
    });
    if (!job) return 'not_found';

    if (job.status === JobStatus.PENDING) {
      const result = await this.prisma.job.updateMany({
        where: { id: jobId, status: JobStatus.PENDING },
        data: {
          status: JobStatus.CANCELLED,
          completedAt: new Date(),
          cancelRequestedAt: new Date(),
          uniqueKey: null,
        },
      });
      if (result.count === 0) return 'not_cancellable';
      await this.runCancelHandlers(job.type, job.payload);
      this.emit({
        jobId,
        type: job.type,
        status: JobStatus.CANCELLED,
        kind: 'cancelled',
      });
      return 'cancelled';
    }

    if (job.status === JobStatus.RUNNING) {
      const entry = this.running.get(jobId);
      const changed = await this.prisma.job.updateMany({
        where: { id: jobId, status: JobStatus.RUNNING },
        data: { cancelRequestedAt: new Date() },
      });
      if (changed.count === 0) return 'not_cancellable';
      entry?.controller.abort();
      return 'aborting';
    }

    return 'not_cancellable';
  }

  async retry(
    jobId: string,
  ): Promise<'retried' | 'not_found' | 'not_retryable'> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, type: true, status: true },
    });
    if (!job) return 'not_found';
    if (job.status !== JobStatus.FAILED && job.status !== JobStatus.CANCELLED) {
      return 'not_retryable';
    }
    if (!this.handlers.has(job.type)) return 'not_retryable';
    const result = await this.prisma.job.updateMany({
      where: {
        id: jobId,
        status: { in: [JobStatus.FAILED, JobStatus.CANCELLED] },
      },
      data: {
        status: JobStatus.PENDING,
        attempts: 0,
        runAt: new Date(),
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
        leaseToken: null,
        completedAt: null,
        cancelRequestedAt: null,
      },
    });
    if (result.count === 0) return 'not_retryable';
    this.emit({
      jobId,
      type: job.type,
      status: JobStatus.PENDING,
      kind: 'retried',
    });
    return 'retried';
  }

  async retryAllFailed(): Promise<number> {
    const registeredTypes = [...this.handlers.keys()];
    if (registeredTypes.length === 0) return 0;
    const result = await this.prisma.job.updateMany({
      where: {
        status: { in: [JobStatus.FAILED, JobStatus.CANCELLED] },
        type: { in: registeredTypes },
      },
      data: {
        status: JobStatus.PENDING,
        attempts: 0,
        runAt: new Date(),
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
        leaseToken: null,
        completedAt: null,
        cancelRequestedAt: null,
      },
    });
    if (result.count > 0) {
      this.emit({
        jobId: 'bulk',
        type: '*',
        status: JobStatus.PENDING,
        kind: 'retried',
      });
    }
    return result.count;
  }

  private async recoverExpired(): Promise<void> {
    const now = new Date();
    await this.prisma.job.updateMany({
      where: {
        cancelRequestedAt: { not: null },
        leaseExpiresAt: { lte: now },
        status: JobStatus.RUNNING,
      },
      data: {
        completedAt: now,
        lastError: 'Cancelled',
        leaseExpiresAt: null,
        leaseToken: null,
        lockedAt: null,
        lockedBy: null,
        status: JobStatus.CANCELLED,
        uniqueKey: null,
      },
    });
    await this.prisma.job.updateMany({
      where: {
        leaseExpiresAt: { lte: now },
        status: JobStatus.RUNNING,
      },
      data: {
        leaseExpiresAt: null,
        leaseToken: null,
        lockedAt: null,
        lockedBy: null,
        status: JobStatus.PENDING,
      },
    });
  }

  private async dispatch(): Promise<void> {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      while (this.running.size < this.concurrency) {
        const job = await this.claimNext();
        if (!job) break;
        void this.execute(job).finally(() => void this.dispatch());
      }
    } finally {
      this.dispatching = false;
    }
  }

  private async runNext(): Promise<void> {
    const job = await this.claimNext();
    if (job) await this.execute(job);
  }

  private async claimNext(): Promise<ClaimedJob | null> {
    const registeredTypes = [...this.handlers.keys()];
    if (registeredTypes.length === 0) return null;
    const now = new Date();
    const available: Prisma.JobWhereInput = {
      runAt: { lte: now },
      status: JobStatus.PENDING,
      type: { in: registeredTypes },
    };
    const orderBy: Prisma.JobOrderByWithRelationInput[] = [
      { runAt: 'asc' },
      { createdAt: 'asc' },
    ];
    const old = await this.prisma.job.findFirst({
      where: {
        ...available,
        createdAt: { lte: new Date(now.getTime() - 5 * 60_000) },
      },
      orderBy,
    });
    const priority = old
      ? null
      : await this.prisma.job.findFirst({
          where: { ...available, type: { in: [...PRIORITY_TYPES] } },
          orderBy,
        });
    const job =
      old ??
      priority ??
      (await this.prisma.job.findFirst({ where: available, orderBy }));
    if (!job) return null;

    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(Date.now() + LEASE_MS);
    const claimed = await this.prisma.job.updateMany({
      where: { id: job.id, status: JobStatus.PENDING },
      data: {
        attempts: { increment: 1 },
        cancelRequestedAt: null,
        leaseExpiresAt,
        leaseToken,
        lockedAt: now,
        lockedBy: this.workerId,
        status: JobStatus.RUNNING,
      },
    });
    if (claimed.count === 0) return this.claimNext();
    this.emit({
      jobId: job.id,
      type: job.type,
      status: JobStatus.RUNNING,
      kind: 'started',
    });
    return { ...job, leaseToken };
  }

  private async execute(job: ClaimedJob): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) return;
    const controller = new AbortController();
    const context: JobContext = {
      ...(job.type === 'SYNC_OPENALEX_AUTHOR'
        ? { deadlineAt: new Date(Date.now() + SOURCE_DEADLINE_MS) }
        : {}),
      jobId: job.id,
      leaseToken: job.leaseToken,
      signal: controller.signal,
    };
    this.running.set(job.id, {
      controller,
      type: job.type,
      payload: job.payload,
    });
    const heartbeat = setInterval(
      () => void this.heartbeat(context, controller),
      HEARTBEAT_MS,
    );

    try {
      await runWithJobContext(context, () => handler(job.payload, context));
      try {
        await this.completeJob(this.prisma, context);
      } catch (error) {
        const state = await this.prisma.job.findUnique({
          where: { id: job.id },
          select: { status: true },
        });
        if (state?.status !== JobStatus.SUCCEEDED) throw error;
      }
      this.emit({
        jobId: job.id,
        type: job.type,
        status: JobStatus.SUCCEEDED,
        kind: 'succeeded',
      });
    } catch (error) {
      const state =
        controller.signal.aborted || error instanceof JobLeaseLostError
          ? await this.prisma.job.findUnique({
              where: { id: job.id },
              select: { cancelRequestedAt: true, status: true },
            })
          : null;
      if (
        state?.status === JobStatus.RUNNING &&
        (controller.signal.aborted || state.cancelRequestedAt)
      ) {
        const cancelled = await this.prisma.job.updateMany({
          where: {
            id: job.id,
            leaseToken: job.leaseToken,
            status: JobStatus.RUNNING,
          },
          data: {
            completedAt: new Date(),
            lastError: 'Cancelled',
            leaseExpiresAt: null,
            leaseToken: null,
            lockedAt: null,
            lockedBy: null,
            status: JobStatus.CANCELLED,
            uniqueKey: null,
          },
        });
        if (cancelled.count) {
          await this.runCancelHandlers(job.type, job.payload);
          this.emit({
            jobId: job.id,
            type: job.type,
            status: JobStatus.CANCELLED,
            kind: 'cancelled',
          });
        }
      } else if (!(error instanceof JobLeaseLostError)) {
        await this.fail(job, error);
      }
    } finally {
      clearInterval(heartbeat);
      this.running.delete(job.id);
      await this.notifySettled(job.type);
    }
  }

  private async heartbeat(
    context: JobContext,
    controller: AbortController,
  ): Promise<void> {
    if (context.deadlineAt && context.deadlineAt <= new Date()) {
      controller.abort();
      return;
    }
    const heartbeat = await this.prisma.job.updateMany({
      where: activeLeaseWhere(context),
      data: {
        leaseExpiresAt: new Date(Date.now() + LEASE_MS),
        lockedAt: new Date(),
      },
    });
    if (heartbeat.count === 0) controller.abort();
  }

  private async fail(job: ClaimedJob, error: unknown): Promise<void> {
    const attempts = job.attempts + 1;
    const message = error instanceof Error ? error.message : String(error);
    const deferred = error instanceof DeferredJobError;
    const failed = deferred || attempts >= job.maxAttempts;
    const changed = await this.prisma.job.updateMany({
      where: {
        id: job.id,
        leaseToken: job.leaseToken,
        status: JobStatus.RUNNING,
      },
      data: {
        completedAt: failed ? new Date() : null,
        lastError: message,
        leaseExpiresAt: null,
        leaseToken: null,
        lockedAt: null,
        lockedBy: null,
        runAt: deferred
          ? error.retryAt
          : new Date(Date.now() + Math.min(60_000, 2 ** attempts * 1_000)),
        status: failed ? JobStatus.FAILED : JobStatus.PENDING,
        ...(failed ? { uniqueKey: null } : {}),
      },
    });
    if (!changed.count) return;
    this.emit({
      jobId: job.id,
      type: job.type,
      status: failed ? JobStatus.FAILED : JobStatus.PENDING,
      kind: 'failed',
    });
    this.logger.error(`Job ${job.id} (${job.type}) failed: ${message}`);
  }
}

function activeLeaseWhere(context: JobContext): Prisma.JobWhereInput {
  return {
    cancelRequestedAt: null,
    id: context.jobId,
    leaseExpiresAt: { gt: new Date() },
    leaseToken: context.leaseToken,
    status: JobStatus.RUNNING,
  };
}

function toJobView(job: {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  runAt: Date;
  lockedAt: Date | null;
  completedAt: Date | null;
  cancelRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): JobListView {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    subject: jobSubject(job.payload),
    lastError: sanitizeError(job.lastError),
    runAt: job.runAt,
    lockedAt: job.lockedAt,
    completedAt: job.completedAt,
    cancelRequestedAt: job.cancelRequestedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function jobSubject(payload: Prisma.JsonValue): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  for (const key of [
    'personId',
    'researchItemId',
    'applicationId',
    'documentId',
    'subscriptionId',
  ]) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === 'string') return `${key}: ${value}`;
  }
  const url = (payload as Record<string, unknown>).url;
  if (typeof url === 'string') return url.slice(0, 120);
  return null;
}

function sanitizeError(message: string | null): string | null {
  if (!message) return null;
  return message.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function isForeignKeyConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  );
}
