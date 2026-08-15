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

export function ProfileReviewQueue() {
  const router = useRouter();
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
                    <DataTableCell>
                      <strong className={cn("block", loadingPlaceholder(loading, "text", "long"))} data-placeholder="text" data-placeholder-width="long">{request?.person.fullName ?? "Loading member"}</strong>
                      <span className={cn("mt-[.2rem] block text-[.72rem] text-ink-muted", loadingPlaceholder(loading, "label", "medium"))} data-placeholder="label" data-placeholder-width="medium">{request?.person.publicEmail ?? "Loading public email"}</span>
                    </DataTableCell>
                    <DataTableCell className={loadingPlaceholder(loading, "value")} data-placeholder="value">{request ? profileChangeCount(request) : 0} fields</DataTableCell>
                    <DataTableCell className="font-mono text-[.7rem] text-ink-muted">
                      <time className={loadingPlaceholder(loading, "label", "medium")} data-placeholder="label" data-placeholder-width="medium" dateTime={request?.submittedAt}>
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
