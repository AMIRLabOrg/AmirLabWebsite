"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { AdminOnly } from "@/components/admin-only";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatePanel } from "@/components/state-panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonControl, ButtonLink } from "@/components/ui/button-control";
import {
  DataTable,
  DataTableCard,
  DataTableCell,
  DataTableHeadCell,
  DataTableRow,
  DataTableShell,
} from "@/components/ui/data-table";
import {
  RowActionMenu,
  RowActionMenuItem,
} from "@/components/ui/row-action-menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectControl } from "@/components/ui/select-control";
import { SemanticStatus } from "@/components/ui/semantic-status";
import {
  WorkspaceHero,
  WorkspaceFacts,
  WorkspaceMetric,
  WorkspaceMetricStrip,
  WorkspacePanel,
  WorkspaceSurface,
} from "@/components/ui/workspace-surface";
import { apiRequest } from "@/lib/client-api";
import type { JobStatusValue } from "@/lib/job-live-events";
import { useNotifications } from "@/components/notification-provider";
import { PaginationControls } from "@/components/pagination-controls";

interface JobRow {
  id: string;
  type: string;
  status: JobStatusValue;
  attempts: number;
  maxAttempts: number;
  subject: string | null;
  lastError: string | null;
  runAt: string;
  lockedAt: string | null;
  completedAt: string | null;
  cancelRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface JobList {
  items: JobRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface JobSummary {
  statuses: Record<string, number>;
  registeredTypes: string[];
  types: { type: string; status: JobStatusValue; count: number }[];
  succeeded24h: number;
  failed24h: number;
  health?: {
    oldestPendingSeconds: number | null;
    expiredLeases: number;
    staleProfiles: number;
    neverSyncedProfiles: number;
    oldestDeliveryFailureAt: string | null;
    outputConflicts: number;
  };
}

interface BackupStatus {
  busy: boolean;
  configured: boolean;
  reason: string | null;
  lastBackup: { id: string; createdAt: string; verified: boolean } | null;
}

const STATUS_BADGE: Record<JobStatusValue, { tone: BadgeTone; label: string }> =
  {
    PENDING: { label: "Pending", tone: "neutral" },
    RUNNING: { label: "Running", tone: "info" },
    SUCCEEDED: { label: "Succeeded", tone: "success" },
    FAILED: { label: "Failed", tone: "error" },
    CANCELLED: { label: "Cancelled", tone: "warning" },
  };

const JOB_TYPE_LABELS: Record<string, string> = {
  DISCOVER_RESEARCH_SOURCE: "Research source discovery (retired)",
  CLEANUP_RESEARCH_OUTPUTS: "Cleanup orphan research outputs",
  PARSE_APPLICATION: "Parse application",
  RECALCULATE_ALL_RANKS: "Recalculate ranks",
  REVALIDATE_PUBLIC_CACHE: "Revalidate public cache",
  SEND_APPLICATION_REJECTION: "Send rejection email",
  SEND_EMAIL: "Send email",
  SEND_ISSUED_DOCUMENT: "Send issued document",
  SYNC_OPENALEX_AUTHOR: "OpenAlex author sync",
  SYNC_SCHOLAR_PROFILE: "Google Scholar sync (retired)",
  WEB_PUSH: "Web push",
};

function jobTypeLabel(type: string): string {
  const known = JOB_TYPE_LABELS[type];
  if (known) return known;
  const words = type.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

function jobDuration(job: JobRow): string {
  if (!job.lockedAt) return "—";
  const started = new Date(job.lockedAt).getTime();
  const ended = job.completedAt
    ? new Date(job.completedAt).getTime()
    : Date.now();
  const seconds = Math.max(0, Math.round((ended - started) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function WorkersMonitor() {
  const { subscribeJobEvents, showToast } = useNotifications();
  const [summary, setSummary] = useState<JobSummary | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobPage, setJobPage] = useState<JobList>();
  const [backup, setBackup] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
  const [actionJobId, setActionJobId] = useState<string>();
  const [pendingCancel, setPendingCancel] = useState<JobRow | null>(null);
  const [retryAllOpen, setRetryAllOpen] = useState(false);
  const reloadTimer = useRef<number | undefined>(undefined);

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setRefreshing(true);
      const params = new URLSearchParams({
        pageSize: "50",
        page: String(page),
      });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      try {
        const [nextSummary, nextJobs, nextBackup] = await Promise.all([
          apiRequest<JobSummary>("/admin/jobs/summary", { method: "GET" }),
          apiRequest<JobList>(`/admin/jobs?${params.toString()}`, {
            method: "GET",
          }),
          apiRequest<BackupStatus>("/backups/status", { method: "GET" }).catch(
            () => null,
          ),
        ]);
        setSummary(nextSummary);
        setJobPage(nextJobs);
        setJobs(nextJobs.items);
        setBackup(nextBackup);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, statusFilter, typeFilter],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(false), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const scheduleReload = useCallback(() => {
    window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => void load(false), 400);
  }, [load]);

  useEffect(() => {
    const unsubscribe = subscribeJobEvents(() => {
      scheduleReload();
    });
    return () => unsubscribe();
  }, [scheduleReload, subscribeJobEvents]);

  useEffect(() => {
    const reload = () => {
      if (document.visibilityState === "visible") scheduleReload();
    };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    return () => {
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
      window.clearTimeout(reloadTimer.current);
    };
  }, [scheduleReload]);

  async function cancelJob(job: JobRow) {
    setActionJobId(job.id);
    try {
      await apiRequest(`/admin/jobs/${job.id}/cancel`, { method: "POST" });
      showToast({
        body: `${jobTypeLabel(job.type)} was asked to stop.`,
        title: "Cancellation requested",
      });
      setPendingCancel(null);
      await load(false);
    } catch (caught) {
      showToast({
        body:
          caught instanceof Error
            ? caught.message
            : "The job could not be cancelled.",
        title: "Cancellation failed",
        tone: "error",
      });
    } finally {
      setActionJobId(undefined);
    }
  }

  async function retryJob(job: JobRow) {
    setActionJobId(job.id);
    try {
      await apiRequest(`/admin/jobs/${job.id}/retry`, { method: "POST" });
      showToast({
        body: `${jobTypeLabel(job.type)} was queued again.`,
        title: "Job retried",
      });
      await load(false);
    } catch (caught) {
      showToast({
        body:
          caught instanceof Error ? caught.message : "The job could not retry.",
        title: "Retry failed",
        tone: "error",
      });
    } finally {
      setActionJobId(undefined);
    }
  }

  async function retryAll() {
    setActionJobId("bulk");
    try {
      const result = await apiRequest<{ count: number }>(
        "/admin/jobs/retry-failed",
        { method: "POST" },
      );
      showToast({
        body:
          result.count === 0
            ? "There were no failed jobs to retry."
            : `${result.count} job(s) queued again.`,
        title: "Retry failed jobs",
      });
      setRetryAllOpen(false);
      await load(false);
    } catch (caught) {
      showToast({
        body:
          caught instanceof Error ? caught.message : "Jobs could not retry.",
        title: "Retry failed",
        tone: "error",
      });
    } finally {
      setActionJobId(undefined);
    }
  }

  const initialLoading = loading && !summary;
  const statuses = summary?.statuses ?? {};
  const failedCount = (statuses.FAILED ?? 0) + (statuses.CANCELLED ?? 0);
  const typeOptions = Array.from(
    new Set([
      ...(summary?.registeredTypes ?? []),
      ...(summary?.types ?? []).map((entry) => entry.type),
    ]),
  )
    .sort()
    .map((type) => ({ label: jobTypeLabel(type), value: type }));

  return (
    <AdminOnly>
      <WorkspaceSurface measure="wide">
        <WorkspaceHero
          eyebrow="Administration"
          title="Workers & tasks"
          description="Background jobs processed by the API worker, plus the scheduled backup state."
          action={
            <ButtonControl
              busy={refreshing}
              onClick={() => void load(true)}
              variant="secondary"
            >
              <RefreshCw aria-hidden="true" size={15} /> Refresh
            </ButtonControl>
          }
        />

        <WorkspaceMetricStrip>
          <WorkspaceMetric
            label="Pending"
            value={statuses.PENDING ?? 0}
            detail="Waiting to run"
            loading={initialLoading}
          />
          <WorkspaceMetric
            label="Running"
            value={statuses.RUNNING ?? 0}
            detail="Active now"
            tone={statuses.RUNNING ? "brand" : "neutral"}
            loading={initialLoading}
          />
          <WorkspaceMetric
            label="Failed (24h)"
            value={summary?.failed24h ?? 0}
            detail="Needs attention"
            tone={summary?.failed24h ? "attention" : "neutral"}
            loading={initialLoading}
          />
          <WorkspaceMetric
            label="Succeeded (24h)"
            value={summary?.succeeded24h ?? 0}
            detail="Completed"
            tone="success"
            loading={initialLoading}
          />
        </WorkspaceMetricStrip>
        {summary?.health ? (
          <WorkspacePanel
            compact
            title="Queue health"
            description="Source data is stale after 48 hours without a successful sync."
          >
            <WorkspaceFacts>
              <div>
                <dt>Oldest pending</dt>
                <dd>
                  {summary.health.oldestPendingSeconds === null
                    ? "No pending jobs"
                    : `${Math.floor(summary.health.oldestPendingSeconds / 60)} minutes`}
                </dd>
              </div>
              <div>
                <dt>Expired worker leases</dt>
                <dd>{summary.health.expiredLeases}</dd>
              </div>
              <div>
                <dt>Stale / never synced profiles</dt>
                <dd>
                  {summary.health.staleProfiles} /{" "}
                  {summary.health.neverSyncedProfiles}
                </dd>
              </div>
              <div>
                <dt>Source issues</dt>
                <dd>{summary.health.outputConflicts}</dd>
              </div>
              <div>
                <dt>Oldest delivery failure</dt>
                <dd>
                  {summary.health.oldestDeliveryFailureAt
                    ? new Date(
                        summary.health.oldestDeliveryFailureAt,
                      ).toLocaleString()
                    : "None"}
                </dd>
              </div>
            </WorkspaceFacts>
          </WorkspacePanel>
        ) : null}

        <WorkspacePanel
          title="Scheduled backups"
          description="Backups run on their own timer rather than the job queue."
          action={
            <ButtonLink href="/workspace/settings/backups">
              Backup settings
            </ButtonLink>
          }
        >
          <div className="grid gap-2 px-[var(--workspace-gutter)] py-4">
            <SemanticStatus tone={backup?.busy ? "info" : "neutral"}>
              {!backup
                ? "Backup status unavailable."
                : backup.busy
                  ? "A backup is running now."
                  : backup.lastBackup
                    ? `Last backup ${formatTime(backup.lastBackup.createdAt)}.`
                    : "No backup has been created yet."}
            </SemanticStatus>
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          title="Background jobs"
          description="Live-updating list of queued, running and completed work."
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <SelectControl
                ariaLabel="Filter by job type"
                onValueChange={(value) => {
                  setLoading(true);
                  setPage(1);
                  setTypeFilter(value === "ALL" ? "" : value);
                }}
                value={typeFilter || "ALL"}
                options={[{ label: "All types", value: "ALL" }, ...typeOptions]}
              />
              {failedCount > 0 ? (
                <ButtonControl
                  variant="secondary"
                  onClick={() => setRetryAllOpen(true)}
                >
                  Retry failed ({failedCount})
                </ButtonControl>
              ) : null}
            </div>
          }
        >
          <div className="border-b border-line px-[var(--workspace-gutter)] py-4">
            <SegmentedControl
              ariaLabel="Filter by status"
              value={statusFilter}
              onValueChange={(value) => {
                setLoading(true);
                setPage(1);
                setStatusFilter(value);
              }}
              options={[
                { label: "All", tone: "neutral", value: "ALL" },
                { label: "Running", tone: "brand", value: "RUNNING" },
                { label: "Pending", tone: "gold", value: "PENDING" },
                { label: "Failed", tone: "danger", value: "FAILED" },
                { label: "Cancelled", tone: "caution", value: "CANCELLED" },
              ]}
            />
          </div>
          <PaginationControls
            page={page}
            pageSize={50}
            total={jobPage?.total}
            totalPages={jobPage?.totalPages}
            loading={loading || refreshing}
            onPageChange={(nextPage) => {
              setLoading(true);
              setPage(nextPage);
            }}
          />
          {error && jobs.length === 0 ? (
            <StatePanel
              variant="error"
              frame="workspace"
              title="Unable to load jobs"
              body="The worker queue could not be read. Retry in a moment."
              action={{ label: "Try again", onClick: () => void load(true) }}
            />
          ) : !loading && jobs.length === 0 ? (
            <StatePanel
              frame="workspace"
              variant={
                statusFilter === "ALL" && !typeFilter ? "empty" : "filtered"
              }
              title={
                statusFilter === "ALL" && !typeFilter
                  ? "No background jobs"
                  : "No matching jobs"
              }
              body={
                statusFilter === "ALL" && !typeFilter
                  ? "Jobs appear here as the system queues background work."
                  : "Adjust the filters to see other jobs."
              }
            />
          ) : (
            <DataTableShell>
              <DataTableCard>
                <DataTable>
                  <thead>
                    <tr>
                      <DataTableHeadCell>Job</DataTableHeadCell>
                      <DataTableHeadCell>Status</DataTableHeadCell>
                      <DataTableHeadCell>Attempts</DataTableHeadCell>
                      <DataTableHeadCell>Duration</DataTableHeadCell>
                      <DataTableHeadCell>Updated</DataTableHeadCell>
                      <DataTableHeadCell>Detail</DataTableHeadCell>
                      <DataTableHeadCell aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 4 }).map((_, index) => (
                          <DataTableRow key={`placeholder-${index}`}>
                            <DataTableCell colSpan={7}>
                              <span className="text-ink-muted">Loading…</span>
                            </DataTableCell>
                          </DataTableRow>
                        ))
                      : Object.entries(
                          jobs.reduce<Record<string, JobRow[]>>(
                            (groups, job) => {
                              (groups[job.type] ??= []).push(job);
                              return groups;
                            },
                            {},
                          ),
                        ).flatMap(([type, rows]) => [
                          <tr
                            className="border-b border-line bg-surface-subtle"
                            key={`group-${type}`}
                          >
                            <td className="px-3 py-2" colSpan={7}>
                              <button
                                className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-control px-2 text-left transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand"
                                aria-expanded={expandedTypes.includes(type)}
                                onClick={() =>
                                  setExpandedTypes((current) =>
                                    current.includes(type)
                                      ? current.filter((item) => item !== type)
                                      : [...current, type],
                                  )
                                }
                                type="button"
                              >
                                {expandedTypes.includes(type) ? (
                                  <ChevronDown aria-hidden="true" size={16} />
                                ) : (
                                  <ChevronRight aria-hidden="true" size={16} />
                                )}
                                <strong className="font-semibold">
                                  {jobTypeLabel(type)}
                                </strong>
                                <span className="text-xs text-ink-muted">
                                  {rows.length}{" "}
                                  {rows.length === 1 ? "run" : "runs"} shown
                                </span>
                                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                                  {Object.entries(
                                    summary?.types
                                      .filter((item) => item.type === type)
                                      .reduce<Record<string, number>>(
                                        (counts, item) => {
                                          counts[item.status] =
                                            (counts[item.status] ?? 0) +
                                            item.count;
                                          return counts;
                                        },
                                        {},
                                      ) ?? {},
                                  ).map(([status, count]) => (
                                    <Badge
                                      key={status}
                                      tone={
                                        STATUS_BADGE[status as JobStatusValue]
                                          ?.tone ?? "neutral"
                                      }
                                    >
                                      {count} {status.toLowerCase()}
                                    </Badge>
                                  ))}
                                </span>
                              </button>
                            </td>
                          </tr>,
                          ...(expandedTypes.includes(type)
                            ? rows.map((job) => {
                                const badge = STATUS_BADGE[job.status];
                                const cancellable =
                                  job.status === "PENDING" ||
                                  job.status === "RUNNING";
                                const retryable =
                                  job.status === "FAILED" ||
                                  job.status === "CANCELLED";
                                return (
                                  <DataTableRow key={job.id}>
                                    <DataTableCell>
                                      <div className="grid gap-0.5">
                                        {job.subject ? (
                                          <span className="font-mono text-[.6rem] text-ink-muted">
                                            {job.subject}
                                          </span>
                                        ) : null}
                                      </div>
                                    </DataTableCell>
                                    <DataTableCell>
                                      <Badge
                                        dot
                                        live={job.status === "RUNNING"}
                                        tone={badge.tone}
                                      >
                                        {badge.label}
                                      </Badge>
                                    </DataTableCell>
                                    <DataTableCell>
                                      {job.attempts}/{job.maxAttempts}
                                    </DataTableCell>
                                    <DataTableCell>
                                      {jobDuration(job)}
                                    </DataTableCell>
                                    <DataTableCell>
                                      {formatTime(job.updatedAt)}
                                    </DataTableCell>
                                    <DataTableCell>
                                      <span
                                        className="text-ink-muted"
                                        title={job.lastError ?? undefined}
                                      >
                                        {job.status === "RUNNING" &&
                                        job.cancelRequestedAt
                                          ? "Stopping…"
                                          : (job.lastError ?? "—")}
                                      </span>
                                    </DataTableCell>
                                    <DataTableCell>
                                      {cancellable || retryable ? (
                                        <RowActionMenu
                                          disabled={actionJobId === job.id}
                                        >
                                          {cancellable ? (
                                            <RowActionMenuItem
                                              danger
                                              onSelect={() =>
                                                setPendingCancel(job)
                                              }
                                            >
                                              Cancel job
                                            </RowActionMenuItem>
                                          ) : null}
                                          {retryable ? (
                                            <RowActionMenuItem
                                              onSelect={() =>
                                                void retryJob(job)
                                              }
                                            >
                                              Retry job
                                            </RowActionMenuItem>
                                          ) : null}
                                        </RowActionMenu>
                                      ) : null}
                                    </DataTableCell>
                                  </DataTableRow>
                                );
                              })
                            : []),
                        ])}
                  </tbody>
                </DataTable>
              </DataTableCard>
            </DataTableShell>
          )}
        </WorkspacePanel>
      </WorkspaceSurface>

      <ConfirmDialog
        open={Boolean(pendingCancel)}
        tone="danger"
        title="Cancel this job?"
        description={
          pendingCancel
            ? `“${jobTypeLabel(pendingCancel.type)}” will be asked to stop. A running step may finish before it halts, and work already saved stays in place.`
            : ""
        }
        confirmLabel="Cancel job"
        busy={actionJobId === pendingCancel?.id}
        onCancel={() => setPendingCancel(null)}
        onConfirm={() => {
          if (pendingCancel) void cancelJob(pendingCancel);
        }}
      />
      <ConfirmDialog
        open={retryAllOpen}
        title="Retry all failed jobs?"
        description={`${failedCount} failed or cancelled job(s) will be queued again from the start.`}
        confirmLabel="Retry jobs"
        busy={actionJobId === "bulk"}
        onCancel={() => setRetryAllOpen(false)}
        onConfirm={() => void retryAll()}
      />
    </AdminOnly>
  );
}
