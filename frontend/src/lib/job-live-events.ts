export type JobStatusValue =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export type JobChangeKind =
  | "created"
  | "started"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "retried";

export interface JobLiveEvent {
  scope: "jobs";
  kind: JobChangeKind;
  jobId: string;
  type: string;
  status: JobStatusValue;
}

const STATUSES: readonly JobStatusValue[] = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
];

const KINDS: readonly JobChangeKind[] = [
  "created",
  "started",
  "succeeded",
  "failed",
  "cancelled",
  "retried",
];

function isStatus(value: unknown): value is JobStatusValue {
  return STATUSES.includes(value as JobStatusValue);
}

function isKind(value: unknown): value is JobChangeKind {
  return KINDS.includes(value as JobChangeKind);
}

export function parseJobLiveEvent(value: unknown): JobLiveEvent | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    record.scope !== "jobs" ||
    !isKind(record.kind) ||
    !isStatus(record.status) ||
    typeof record.jobId !== "string" ||
    !record.jobId ||
    typeof record.type !== "string"
  ) {
    return null;
  }
  return {
    kind: record.kind,
    scope: "jobs",
    jobId: record.jobId,
    type: record.type,
    status: record.status,
  };
}
