import { AsyncLocalStorage } from 'node:async_hooks';

export interface JobContext {
  deadlineAt?: Date;
  jobId: string;
  leaseToken: string;
  signal: AbortSignal;
}

const storage = new AsyncLocalStorage<JobContext>();

export function runWithJobContext<T>(context: JobContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentJobContext(): JobContext | undefined {
  return storage.getStore();
}

export function currentJobSignal(): AbortSignal | undefined {
  return storage.getStore()?.signal;
}

// Combines a per-request timeout with the current job's cancellation signal so
// outbound work stops when an admin cancels the job.
export function withJobSignal(signal?: AbortSignal): AbortSignal | undefined {
  const jobSignal = currentJobSignal();
  if (!jobSignal) return signal;
  if (!signal) return jobSignal;
  return AbortSignal.any([signal, jobSignal]);
}
