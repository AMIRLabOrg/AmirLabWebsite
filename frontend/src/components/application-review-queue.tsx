"use client";

import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { useDeferredValue, useEffect, useState } from "react";
import { PaginationControls } from "./pagination-controls";
import { StatePanel } from "./state-panel";
import { ToolbarSearchField } from "./ui/toolbar-search-field";
import { DateRangePicker } from "./ui/date-range-picker";
import { SelectControl } from "./ui/select-control";
import { Badge, type BadgeTone } from "./ui/badge";
import {
  DataTable,
  DataTableCard,
  DataTableCell,
  DataTableHeadCell,
  DataTableRow,
  DataTableShell,
} from "@/components/ui/data-table";
import { apiRequest } from "@/lib/client-api";
import type { PaginatedResponse } from "@/lib/types";
import { ButtonControl, ButtonLink } from "@/components/ui/button-control";
import { FormField } from "@/components/ui/form-field";
import { ReviewIssueStamp } from "@/components/ui/semantic-status";
import type { ReviewIssue } from "@/lib/review-issues";

interface ApplicationSummary {
  id: string;
  fullName: string;
  email: string;
  status: string;
  createdAt: string;
  position: { title: string };
}

const STATUSES = [
  "ALL",
  "NEEDS_REVIEW",
  "PARSING",
  "PARSE_FAILED",
  "ACCEPTED",
  "REJECTED",
];

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export function ApplicationReviewQueue() {
  const [result, setResult] = useState<PaginatedResponse<ApplicationSummary>>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("NEWEST");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sort,
    });
    if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
    if (status !== "ALL") params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    void apiRequest<PaginatedResponse<ApplicationSummary>>(
      `/applications?${params}`,
      { method: "GET" },
    )
      .then((response) => {
        if (!active) return;
        setResult(response);
        setError(undefined);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load applications.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [deferredSearch, from, page, reload, sort, status, to]);

  const filtered = Boolean(search || from || to || status !== "ALL");
  const clear = () => {
    setLoading(true);
    setSearch("");
    setStatus("ALL");
    setFrom("");
    setTo("");
    setPage(1);
  };

  return (
    <DataTableShell>
      <div className="grid min-w-0 grid-cols-[minmax(220px,1.4fr)_repeat(2,minmax(140px,.52fr))_minmax(220px,.8fr)_auto] items-end gap-[.8rem] rounded-panel border border-line bg-surface p-4 max-[980px]:grid-cols-2 max-[640px]:grid-cols-1">
        <ToolbarSearchField
          id="application-search"
          label="Search"
          onChange={(event) => {
            setLoading(true);
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Name, email, or position"
          value={search}
        />
        <FormField htmlFor="application-status" label="Status">
          <SelectControl
            id="application-status"
            onValueChange={(value) => {
              setLoading(true);
              setStatus(value);
              setPage(1);
            }}
            options={STATUSES.map((value) => ({
              label: value === "ALL" ? "All statuses" : label(value),
              value,
            }))}
            value={status}
          />
        </FormField>
        <FormField htmlFor="application-sort" label="Sort">
          <SelectControl
            id="application-sort"
            onValueChange={(value) => {
              setLoading(true);
              setSort(value);
              setPage(1);
            }}
            options={[
              { label: "Newest", value: "NEWEST" },
              { label: "Oldest", value: "OLDEST" },
              { label: "Name", value: "NAME" },
            ]}
            value={sort}
          />
        </FormField>
        <FormField label="Date range">
          <DateRangePicker
            from={from}
            onChange={(range) => {
              setLoading(true);
              setFrom(range.from);
              setTo(range.to);
              setPage(1);
            }}
            to={to}
          />
        </FormField>
        <ButtonControl disabled={!filtered} onClick={clear}>
          Clear
        </ButtonControl>
      </div>

      {error && result ? (
        <p className="m-0 flex items-center gap-[.45rem] text-[.82rem] leading-[1.5] text-ink-muted rounded-panel bg-danger-soft p-[.8rem] text-danger">
          {error}
        </p>
      ) : null}

      {error && !result ? (
        <StatePanel
          action={{
            label: "Retry",
            onClick: () => {
              setLoading(true);
              setReload((value) => value + 1);
            },
          }}
          body="The connection dropped. Nothing was lost; reconnect to continue."
          title="Could not load applications"
          variant="error"
        />
      ) : loading || result?.items.length ? (
        <>
          <DataTableCard data-loading={loading || undefined}>
            <DataTable>
              <thead>
                <tr>
                  <DataTableHeadCell>Applicant</DataTableHeadCell>
                  <DataTableHeadCell>Position</DataTableHeadCell>
                  <DataTableHeadCell>Submitted</DataTableHeadCell>
                  <DataTableHeadCell>ATS check</DataTableHeadCell>
                  <DataTableHeadCell>Status</DataTableHeadCell>
                  <DataTableHeadCell>
                    <span className="sr-only">Action</span>
                  </DataTableHeadCell>
                  <DataTableHeadCell className="w-[48px]">
                    <span className="sr-only">Attention</span>
                  </DataTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {(loading && !result?.items.length
                  ? Array.from({ length: 6 }, () => undefined)
                  : (result?.items ?? [])
                ).map((application, row) => {
                  const failed = application?.status === "PARSE_FAILED";
                  return (
                    <DataTableRow
                      key={application?.id ?? `application-loading-${row}`}
                    >
                      <DataTableCell>
                        <strong
                          className={cn(
                            "block",
                            loadingPlaceholder(loading, "text", "long"),
                          )}
                          data-placeholder="text"
                          data-placeholder-width="long"
                        >
                          {application?.fullName ?? "Loading applicant"}
                        </strong>
                        <span
                          className={cn(
                            "mt-[.2rem] block text-[.72rem] text-ink-muted",
                            loadingPlaceholder(loading, "label", "medium"),
                          )}
                          data-placeholder="label"
                          data-placeholder-width="medium"
                        >
                          {application?.email ?? "loading@example.org"}
                        </span>
                      </DataTableCell>
                      <DataTableCell
                        className={loadingPlaceholder(loading, "text", "long")}
                        data-placeholder="text"
                        data-placeholder-width="long"
                      >
                        {application?.position.title ?? "Loading position"}
                      </DataTableCell>
                      <DataTableCell className="font-mono text-[.7rem] text-ink-muted">
                        <time
                          className={loadingPlaceholder(
                            loading,
                            "label",
                            "medium",
                          )}
                          data-placeholder="label"
                          data-placeholder-width="medium"
                          dateTime={application?.createdAt}
                        >
                          {application?.createdAt
                            ? new Date(
                                application.createdAt,
                              ).toLocaleDateString()
                            : "Loading date"}
                        </time>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge
                          dot
                          loading={loading}
                          tone={
                            failed
                              ? "error"
                              : application?.status === "PARSING"
                                ? "warning"
                                : "success"
                          }
                        >
                          {failed
                            ? "Not readable"
                            : application?.status === "PARSING"
                              ? "Processing"
                              : "Passed"}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge
                          dot
                          loading={loading}
                          live={application?.status === "NEEDS_REVIEW"}
                          tone={
                            application
                              ? applicationTone(application.status)
                              : "neutral"
                          }
                        >
                          {application ? label(application.status) : "Loading"}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell>
                        <ButtonLink
                          compact
                          href={
                            application
                              ? `/workspace/applications/${application.id}`
                              : "#"
                          }
                          loading={loading || !application}
                          variant="secondary"
                        >
                          {application?.status === "NEEDS_REVIEW"
                            ? "Review"
                            : "View"}
                        </ButtonLink>
                      </DataTableCell>
                      <DataTableCell className="relative w-[48px] p-0">
                        {application ? (
                          <ReviewIssueStamp
                            className="right-2 top-1/2 -translate-y-1/2"
                            issue={applicationStatusIssue(application)}
                          />
                        ) : null}
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </tbody>
            </DataTable>
          </DataTableCard>
          <PaginationControls
            loading={loading}
            onPageChange={(nextPage) => {
              setLoading(true);
              setPage(nextPage);
            }}
            page={result?.page ?? page}
            pageSize={result?.pageSize ?? 20}
            total={result?.total ?? 0}
            totalPages={result?.totalPages ?? 1}
          />
        </>
      ) : (
        <StatePanel
          action={
            filtered ? { label: "Clear filters", onClick: clear } : undefined
          }
          body={
            filtered
              ? "Try a broader date range or remove an active filter."
              : "New applications will appear here after resume processing."
          }
          title={
            filtered
              ? "No matching applications"
              : "The application queue is clear"
          }
          variant={filtered ? "filtered" : "empty"}
        />
      )}
    </DataTableShell>
  );
}

function applicationStatusIssue(
  application: ApplicationSummary,
): ReviewIssue | undefined {
  if (application.status === "PARSE_FAILED") {
    return {
      code: "APPLICATION_PARSE_FAILED",
      itemId: application.id,
      message: "Automatic CV processing could not read this file.",
      tone: "error",
    };
  }
  if (application.status === "PARSING") {
    return {
      code: "APPLICATION_PARSE_PENDING",
      itemId: application.id,
      message: "Automatic CV processing is still running.",
      tone: "pending",
    };
  }
  return undefined;
}

function applicationTone(status: string): BadgeTone {
  if (status === "NEEDS_REVIEW") return "warning";
  if (status === "PARSE_FAILED" || status === "REJECTED") return "error";
  if (status === "ACCEPTED") return "success";
  if (status === "PARSING") return "warning";
  return "neutral";
}
