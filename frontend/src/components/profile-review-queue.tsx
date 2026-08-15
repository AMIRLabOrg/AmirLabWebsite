"use client";

import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import type { PaginatedResponse, ProfileEditRequest } from "@/lib/types";
import { profileValuesEqual } from "@/lib/profile-changes";
import { PaginationControls } from "@/components/pagination-controls";
import { StatePanel } from "@/components/state-panel";
import { DataTable, DataTableCard, DataTableCell, DataTableHeadCell, DataTableRow, DataTableShell } from "@/components/ui/data-table";
import { ToolbarSearchField } from "@/components/ui/toolbar-search-field";
import { SelectControl } from "@/components/ui/select-control";
import { FormField } from "@/components/ui/form-field";
import { ButtonControl } from "@/components/ui/button-control";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { BulkReviewBar } from "@/components/bulk-review-bar";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { useNotifications } from "@/components/notification-provider";

export function ProfileReviewQueue() {
  const router = useRouter();
  const { refreshUnreadCount } = useNotifications();
  const [result, setResult] =
    useState<PaginatedResponse<ProfileEditRequest>>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sort, setSort] = useState("OLDEST");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sort,
    });
    if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
    void apiRequest<PaginatedResponse<ProfileEditRequest>>(
      `/profile-reviews?${params}`,
      { method: "GET" },
    )
      .then((response) => {
        if (!active) return;
        setResult(response);
        setError(undefined);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load queue.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [deferredSearch, page, reload, sort]);

  const bulk = useBulkSelection((result?.items ?? []).map(({ id }) => id));
  const selectedRequests = (result?.items ?? []).filter(({ id }) => bulk.isSelected(id));
  const commonBulkActions = selectedRequests.length && selectedRequests.every(({ status }) => status === "NEEDS_REVIEW")
    ? [
        {
          confirmDescription: `Approve the ${selectedRequests.length} selected profile change request${selectedRequests.length === 1 ? "" : "s"}. Each request is guarded by its current revision.`,
          confirmLabel: "Approve selected",
          confirmTitle: "Approve selected profile changes?",
          label: "Approve selected",
          status: "APPROVED" as const,
          tone: "primary" as const,
        },
        {
          confirmDescription: `Reject the ${selectedRequests.length} selected profile change request${selectedRequests.length === 1 ? "" : "s"} with the same reviewer note.`,
          confirmLabel: "Reject selected",
          confirmTitle: "Reject selected profile changes?",
          label: "Reject selected",
          notePlaceholder: "Explain what these members need to fix.",
          requiresNote: true,
          status: "REJECTED" as const,
          tone: "danger" as const,
        },
      ]
    : [];

  async function decideBulk({ note, status }: { note?: string; status: "APPROVED" | "REJECTED" }) {
    if (!selectedRequests.length) return;
    await apiRequest("/profile-reviews/bulk-review", {
      body: JSON.stringify({
        items: selectedRequests.map(({ id, revision }) => ({ id, revision })),
        ...(note ? { note } : {}),
        status,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    bulk.clear();
    setLoading(true);
    if (selectedRequests.length === (result?.items.length ?? 0) && page > 1) setPage((current) => current - 1);
    else setReload((current) => current + 1);
    void refreshUnreadCount().catch(() => undefined);
  }

  const filtered = Boolean(search);
  const clear = () => {
    setLoading(true);
    setSearch("");
    setPage(1);
  };
  const openReview = (id: string) => router.push(`/workspace/profile-reviews/${id}`);

  return (
    <DataTableShell>
      <div className="grid min-w-0 grid-cols-[minmax(220px,1fr)_minmax(160px,.7fr)_auto] items-end gap-[.8rem] rounded-panel border border-line bg-surface p-4 max-[760px]:grid-cols-1">
        <ToolbarSearchField
          id="profile-review-search"
          label="Search"
          onChange={(event) => {
            setLoading(true);
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Name or public email"
          value={search}
        />
        <FormField htmlFor="profile-review-sort" label="Sort">
          <SelectControl
            id="profile-review-sort"
            onValueChange={(value) => {
              setLoading(true);
              setSort(value);
              setPage(1);
            }}
            options={[
              { label: "Oldest first", value: "OLDEST" },
              { label: "Newest first", value: "NEWEST" },
              { label: "Name A–Z", value: "NAME" },
            ]}
            value={sort}
          />
        </FormField>
        <ButtonControl disabled={!filtered} onClick={clear} variant="secondary">
          Clear
        </ButtonControl>
      </div>

      {loading || result?.items.length ? (
        <BulkReviewBar
          actions={commonBulkActions}
          loading={loading}
          onClear={bulk.clear}
          onSelectAll={bulk.toggleAll}
          onSubmit={decideBulk}
          selectAllState={bulk.selectAllState}
          selectableCount={result?.items.length ?? 0}
          selectedCount={bulk.selectedCount}
          successBody={(status) => `${selectedRequests.length} profile review${selectedRequests.length === 1 ? "" : "s"} ${status === "APPROVED" ? "approved" : "rejected"}.`}
          successTitle="Bulk profile review saved"
        />
      ) : null}

      {error && result ? <p className="m-0 flex items-center gap-[.45rem] text-[.82rem] leading-[1.5] text-ink-muted rounded-panel bg-danger-soft p-[.8rem] text-danger">{error}</p> : null}
      {error && !result ? (
        <StatePanel
          action={{
            label: "Retry",
            onClick: () => {
              setLoading(true);
              setReload((value) => value + 1);
            },
          }}
          body="The connection dropped. Reload to reconnect without losing review data."
          title="Could not load profile edits"
          variant="error"
        />
      ) : loading || result?.items.length ? (
        <>
          <DataTableCard data-loading={loading || undefined}>
            <DataTable>
              <thead>
                <tr>
                  <DataTableHeadCell className="w-[48px]">Select</DataTableHeadCell>
                  <DataTableHeadCell>Member</DataTableHeadCell>
                  <DataTableHeadCell>Changed fields</DataTableHeadCell>
                  <DataTableHeadCell>Submitted</DataTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {(loading && !result?.items.length ? Array.from({ length: 5 }, () => undefined) : result?.items ?? []).map((request, row) => (
                  <DataTableRow
                    aria-disabled={loading || !request}
                    clickable
                    key={request?.id ?? `profile-review-loading-${row}`}
                    onClick={() => request && openReview(request.id)}
                    onKeyDown={(event) => {
                      if (request && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        openReview(request.id);
                      }
                    }}
                    role="link"
                    tabIndex={loading ? -1 : 0}
                  >
                    <DataTableCell
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {request ? (
                        <CheckboxControl
                          ariaLabel={`Select ${request.person.fullName} profile review`}
                          checked={bulk.isSelected(request.id)}
                          className="gap-0"
                          id={`profile-review-select-${request.id}`}
                          onCheckedChange={(checked) => bulk.toggle(request.id, checked)}
                        />
                      ) : <span className={loadingPlaceholder(true, "control")} data-placeholder="control" />}
                    </DataTableCell>
                    <DataTableCell>
                      <strong className={cn("block", loadingPlaceholder(!request, "text", "long"))} data-placeholder="text" data-placeholder-width="long">{request?.person.fullName ?? "Loading member"}</strong>
                      <span className={cn("mt-[.2rem] block text-[.72rem] text-ink-muted", loadingPlaceholder(!request, "label", "medium"))} data-placeholder="label" data-placeholder-width="medium">
                        {request ? request.person.publicEmail?.trim() || "No public email" : "Loading public email"}
                      </span>
                    </DataTableCell>
                    <DataTableCell className={loadingPlaceholder(!request, "value")} data-placeholder="value">{request ? profileChangeCount(request) : 0} fields</DataTableCell>
                    <DataTableCell className="font-mono text-[.7rem] text-ink-muted">
                      <time className={loadingPlaceholder(!request, "label", "medium")} data-placeholder="label" data-placeholder-width="medium" dateTime={request?.submittedAt}>
                        {request?.submittedAt ? new Date(request.submittedAt).toLocaleDateString() : "Loading date"}
                      </time>
                    </DataTableCell>
                  </DataTableRow>
                ))}
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
          action={filtered ? { label: "Clear search", onClick: clear } : undefined}
          body={filtered ? "Try another name or clear the search." : "New member profile changes will appear here when submitted."}
          title={filtered ? "No matching profile edits" : "The profile review queue is clear"}
          variant={filtered ? "filtered" : "empty"}
        />
      )}
    </DataTableShell>
  );
}

function profileChangeCount(request: ProfileEditRequest): number {
  const current = request.person;
  const proposed = request.payload;
  const values = [
    [current.fullName, proposed.fullName],
    [current.headline, proposed.headline],
    [current.biography, proposed.biography],
    [current.publicEmail, proposed.publicEmail],
    [current.phone, proposed.phone],
    [current.contactAddress, proposed.contactAddress],
    [current.expertise, proposed.expertise],
    [
      (current.links ?? []).map(({ label, type, url }) => ({ label, type, url })),
      proposed.links,
    ],
    [
      (current.profileSections ?? []).map(({ content, subsections, title, type }) => ({
        subsections: subsections?.length
          ? subsections
          : content
            ? [{ heading: null, entries: [content] }]
            : [],
        title,
        type,
      })),
      proposed.sections,
    ],
  ];
  const fieldChanges = values.filter(
    ([before, after]) => !profileValuesEqual(before, after),
  ).length;
  const proposedAvatar = proposed.removeAvatar
    ? null
    : (request.avatarAsset?.id ?? current.avatar?.id);
  return fieldChanges + Number(current.avatar?.id !== proposedAvatar);
}
