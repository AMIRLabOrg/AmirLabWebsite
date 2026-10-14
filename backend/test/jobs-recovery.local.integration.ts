import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JobStatus } from '../generated/prisma/client';
import { validateEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { JobLeaseLostError, JobsService } from '../src/jobs/jobs.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL must select an amirl_sqa_* local database',
  );
}
const target = new URL(databaseUrl);
if (
  target.hostname !== '127.0.0.1' ||
  target.port !== '5433' ||
  !target.pathname.slice(1).startsWith('amirl_sqa_')
) {
  throw new Error('TEST_DATABASE_URL must select 127.0.0.1:5433/amirl_sqa_*');
}

const config = new ConfigService<ReturnType<typeof validateEnvironment>, true>(
  validateEnvironment({
    DATABASE_URL: databaseUrl,
    ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    FRONTEND_ORIGINS: 'http://localhost:3000',
    JOB_CONCURRENCY: '2',
    NODE_ENV: 'test',
    STORAGE_PROVIDER: 'local',
  }),
);
const prisma = new PrismaService(config);
const first = new JobsService(prisma, config);
const second = new JobsService(prisma, config);
const privateJobs = (service: JobsService) =>
  service as unknown as {
    heartbeat(
      context: { jobId: string; leaseToken: string; signal: AbortSignal },
      controller: AbortController,
    ): Promise<void>;
    recoverExpired(): Promise<void>;
    runNext(): Promise<void>;
  };

async function waitFor(check: () => boolean, message: string) {
  const deadline = Date.now() + 5_000;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function main() {
  await prisma.$connect();
  const prefix = `sqa.jobs.${randomUUID()}`;
  try {
    const restart = await prisma.job.create({
      data: {
        leaseExpiresAt: new Date(Date.now() + 500),
        leaseToken: randomUUID(),
        lockedAt: new Date(),
        lockedBy: 'dead-worker',
        payload: {},
        status: JobStatus.RUNNING,
        type: `${prefix}.restart`,
      },
    });
    await privateJobs(first).recoverExpired();
    assert.equal(
      (await prisma.job.findUniqueOrThrow({ where: { id: restart.id } }))
        .status,
      JobStatus.RUNNING,
      'healthy_long_job_is_not_reclaimed',
    );
    await new Promise((resolve) => setTimeout(resolve, 550));
    await privateJobs(first).recoverExpired();
    assert.equal(
      (await prisma.job.findUniqueOrThrow({ where: { id: restart.id } }))
        .status,
      JobStatus.PENDING,
      'restart_before_expiry_recovers_on_sweep',
    );

    await assert.rejects(
      prisma.$transaction((transaction) =>
        first.completeJob(transaction, {
          jobId: restart.id,
          leaseToken: randomUUID(),
          signal: new AbortController().signal,
        }),
      ),
      JobLeaseLostError,
      'stale_token_cannot_complete',
    );

    const healthyToken = randomUUID();
    const healthy = await prisma.job.create({
      data: {
        leaseExpiresAt: new Date(Date.now() + 100),
        leaseToken: healthyToken,
        lockedAt: new Date(),
        lockedBy: 'healthy-worker',
        payload: {},
        status: JobStatus.RUNNING,
        type: `${prefix}.healthy`,
      },
    });
    const healthyController = new AbortController();
    await privateJobs(first).heartbeat(
      {
        jobId: healthy.id,
        leaseToken: healthyToken,
        signal: healthyController.signal,
      },
      healthyController,
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    await privateJobs(second).recoverExpired();
    assert.equal(
      (await prisma.job.findUniqueOrThrow({ where: { id: healthy.id } }))
        .status,
      JobStatus.RUNNING,
      'healthy_long_job_is_not_reclaimed',
    );

    const rollbackType = `${prefix}.rollback`;
    let rollbackPrepared = false;
    let releaseRollback = () => {};
    const rollbackRelease = new Promise<void>((resolve) => {
      releaseRollback = resolve;
    });
    first.register(rollbackType, async (_payload, context) => {
      await prisma.$transaction(async (transaction) => {
        for (let index = 0; index < 5; index += 1) {
          await transaction.siteSetting.create({
            data: { key: `${prefix}.rollback.${index}`, value: { index } },
          });
        }
        rollbackPrepared = true;
        await rollbackRelease;
        await first.completeJob(transaction, context);
      });
    });
    const rollbackJob = await prisma.job.create({
      data: { payload: {}, type: rollbackType },
    });
    const rollbackRun = privateJobs(first).runNext();
    await waitFor(
      () => rollbackPrepared,
      'rollback handler did not reach its uncommitted writes',
    );
    assert.equal(await second.cancel(rollbackJob.id), 'aborting');
    releaseRollback();
    await rollbackRun;
    assert.equal(
      await prisma.siteSetting.count({
        where: { key: { startsWith: `${prefix}.rollback.` } },
      }),
      0,
      'cancel_after_five_uncommitted_writes_rolls_everything_back',
    );
    assert.equal(
      (await prisma.job.findUniqueOrThrow({ where: { id: rollbackJob.id } }))
        .status,
      JobStatus.CANCELLED,
    );

    const raceType = `${prefix}.race`;
    let racePrepared = false;
    let releaseRace = () => {};
    const raceRelease = new Promise<void>((resolve) => {
      releaseRace = resolve;
    });
    first.register(raceType, async (_payload, context) => {
      await prisma.$transaction(async (transaction) => {
        await transaction.siteSetting.create({
          data: { key: `${prefix}.race`, value: { complete: true } },
        });
        racePrepared = true;
        await raceRelease;
        await first.completeJob(transaction, context);
      });
    });
    const raceJob = await prisma.job.create({
      data: { payload: {}, type: raceType },
    });
    const raceRun = privateJobs(first).runNext();
    await waitFor(() => racePrepared, 'race handler did not reach commit gate');
    const cancelRace = second.cancel(raceJob.id);
    releaseRace();
    const cancelOutcome = await cancelRace;
    await raceRun;
    const raceState = await prisma.job.findUniqueOrThrow({
      where: { id: raceJob.id },
    });
    const raceWrites = await prisma.siteSetting.count({
      where: { key: `${prefix}.race` },
    });
    assert.ok(
      (raceState.status === JobStatus.SUCCEEDED && raceWrites === 1) ||
        (raceState.status === JobStatus.CANCELLED && raceWrites === 0),
      'cancel_success_race_has_one_atomic_winner',
    );
    assert.equal(
      raceState.status === JobStatus.SUCCEEDED
        ? cancelOutcome === 'not_cancellable'
        : cancelOutcome === 'aborting',
      true,
    );

    const overlapType = `${prefix}.overlap`;
    let concurrent = 0;
    let peak = 0;
    let releaseOverlap = () => {};
    const overlapRelease = new Promise<void>((resolve) => {
      releaseOverlap = resolve;
    });
    const overlapHandler = async () => {
      concurrent += 1;
      peak = Math.max(peak, concurrent);
      await overlapRelease;
      concurrent -= 1;
    };
    first.register(overlapType, overlapHandler);
    second.register(overlapType, overlapHandler);
    await prisma.job.createMany({
      data: [
        { payload: { personId: randomUUID() }, type: overlapType },
        { payload: { personId: randomUUID() }, type: overlapType },
      ],
    });
    const runOne = privateJobs(first).runNext();
    const runTwo = privateJobs(second).runNext();
    await waitFor(() => peak === 2, 'independent workers did not overlap');
    releaseOverlap();
    await Promise.all([runOne, runTwo]);
    assert.equal(peak, 2, 'independent jobs use available worker capacity');
  } finally {
    first.onModuleDestroy();
    second.onModuleDestroy();
    await prisma.siteSetting.deleteMany({
      where: { key: { startsWith: prefix } },
    });
    await prisma.job.deleteMany({ where: { type: { startsWith: prefix } } });
    await prisma.$disconnect();
  }
}

void main();
