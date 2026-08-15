import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JobStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

type JobHandler = (payload: Prisma.JsonValue) => Promise<void>;

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly handlers = new Map<string, JobHandler>();
  private readonly logger = new Logger(JobsService.name);
  private readonly workerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private working = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.job.updateMany({
      where: {
        lockedAt: { lt: new Date(Date.now() - 5 * 60_000) },
        status: JobStatus.RUNNING,
      },
      data: {
        lockedAt: null,
        lockedBy: null,
        status: JobStatus.PENDING,
      },
    });
    this.timer = setInterval(() => void this.runNext(), 2_000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  register(type: string, handler: JobHandler): void {
    if (this.handlers.has(type)) {
      throw new Error(`Job handler already registered for ${type}`);
    }
    this.handlers.set(type, handler);
  }

  async enqueue(
    type: string,
    payload: Prisma.InputJsonValue,
    uniqueKey?: string,
    runAt?: Date,
  ): Promise<string> {
    const job = await this.prisma.job.create({
      data: { type, payload, uniqueKey, runAt },
      select: { id: true },
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

  private async runNext(): Promise<void> {
    if (this.working) {
      return;
    }
    this.working = true;

    try {
      const job = await this.prisma.job.findFirst({
        where: { status: JobStatus.PENDING, runAt: { lte: new Date() } },
        orderBy: [{ runAt: 'asc' }, { createdAt: 'asc' }],
      });
      if (!job) {
        return;
      }

      const claim = await this.prisma.job.updateMany({
        where: { id: job.id, status: JobStatus.PENDING },
        data: {
          attempts: { increment: 1 },
          lockedAt: new Date(),
          lockedBy: this.workerId,
          status: JobStatus.RUNNING,
        },
      });
      if (claim.count === 0) {
        return;
      }

      const handler = this.handlers.get(job.type);
      if (!handler) {
        throw new Error(`No job handler registered for ${job.type}`);
      }

      try {
        await handler(job.payload);
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            completedAt: new Date(),
            lastError: null,
            status: JobStatus.SUCCEEDED,
          },
        });
      } catch (error) {
        const attempts = job.attempts + 1;
        const failed = attempts >= job.maxAttempts;
        const message = error instanceof Error ? error.message : String(error);
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            lastError: message,
            lockedAt: null,
            lockedBy: null,
            runAt: new Date(
              Date.now() + Math.min(60_000, 2 ** attempts * 1_000),
            ),
            status: failed ? JobStatus.FAILED : JobStatus.PENDING,
          },
        });
        this.logger.error(`Job ${job.id} (${job.type}) failed: ${message}`);
      }
    } finally {
      this.working = false;
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
