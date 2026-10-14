"use client";

import { useEffect, useState } from "react";
import {
  WorkspaceCollection,
  WorkspaceRuleBand,
} from "@/components/ui/workspace-surface";
import { useAuth } from "@/components/auth-provider";
import { PaginationControls } from "@/components/pagination-controls";
import { PaperCard } from "@/components/paper-card";
import { StatePanel } from "@/components/state-panel";
import { ToolbarSearchField } from "@/components/ui/toolbar-search-field";
import { FormField } from "@/components/ui/form-field";
import { SelectControl } from "@/components/ui/select-control";
import { apiRequest } from "@/lib/client-api";
import type { PaginatedResponse, ResearchItem } from "@/lib/types";

type LibraryItem = ResearchItem & {
  reviewStatus: string;
  reviewNote: string | null;
  sourceSnapshot?: { failureReason: string | null } | null;
};
const viewDescriptions = {
  current:
    "Published papers and datasets from active OpenAlex author bindings.",
  retained:
    "Previously published works with an inactive person link after an ID change or repeated absence from OpenAlex. Retracted works appear under Source issues.",
  issues:
    "Retracted works and source/import failures. These records are withheld or flagged; source metadata is read-only.",
};

type LibraryView = "current" | "issues" | "retained";

export function ResearchLibrary() {
  const { loading: authLoading, user } = useAuth();
  const staff = user?.role === "ADMIN" || user?.role === "MODERATOR";
  const [page, setPage] = useState(1);
  const [type, setType] = useState("all");
  const [view, setView] = useState<LibraryView>("current");
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<PaginatedResponse<LibraryItem>>();
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      view,
    });
    if (type !== "all") params.set("type", type);
    if (search) params.set("search", search);
    void apiRequest<PaginatedResponse<LibraryItem>>(
      `/research-library?${params}`,
      { method: "GET" },
    )
      .then((next) => {
        if (!active) return;
        setResult(next);
        setError("");
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "The research library could not be loaded.",
        );
      });
    return () => {
      active = false;
    };
  }, [authLoading, page, reload, search, type, user, view]);

  function submitSearch(value: string) {
    setPage(1);
    setSearch(value.trim());
    setReload((value) => value + 1);
  }

  const loading = authLoading || !result;
  return (
    <div className="grid gap-5">
      <WorkspaceRuleBand contentClassName="py-3.5">
        <div
          className={`grid min-w-0 items-end gap-[.8rem] max-[850px]:grid-cols-2 max-[640px]:grid-cols-1 ${staff ? "grid-cols-[minmax(210px,1.5fr)_minmax(150px,.65fr)_minmax(180px,.8fr)]" : "grid-cols-[minmax(210px,1fr)_minmax(150px,.4fr)]"}`}
        >
          <ToolbarSearchField
            id="library-search"
            label="Search library"
            onValueChange={setDraftSearch}
            onSearch={submitSearch}
            placeholder="Title, author, DOI, or source"
            value={draftSearch}
          />
          <FormField htmlFor="library-type" label="Type">
            <SelectControl
              id="library-type"
              ariaLabel="Research output type"
              onValueChange={(value) => {
                setPage(1);
                setType(value);
              }}
              options={[
                { label: "All outputs", value: "all" },
                { label: "Papers", value: "PAPER" },
                { label: "Datasets", value: "DATASET" },
              ]}
              value={type}
            />
          </FormField>
          {staff ? (
            <FormField htmlFor="library-view" label="View">
              <SelectControl
                id="library-view"
                ariaLabel="Library view"
                onValueChange={(value) => {
                  setPage(1);
                  setView(value as LibraryView);
                }}
                options={[
                  { label: "Published outputs", value: "current" },
                  { label: "Link history", value: "retained" },
                  { label: "Source issues", value: "issues" },
                ]}
                value={view}
              />
            </FormField>
          ) : null}
        </div>
      </WorkspaceRuleBand>
      <p
        className="m-0 text-[.76rem] leading-relaxed text-ink-muted"
        role="status"
      >
        {viewDescriptions[view]}
      </p>

      {error ? (
        <StatePanel
          action={{
            label: "Try again",
            onClick: () => setReload((value) => value + 1),
          }}
          body={error}
          title="Could not load research"
          variant="error"
        />
      ) : null}
      {!error || result ? (
        <WorkspaceCollection aria-busy={loading}>
          {(loading
            ? Array.from({ length: 4 }, () => undefined)
            : result.items
          ).map((item, index) => (
            <PaperCard
              item={item}
              key={item?.id ?? `library-loading-${index}`}
              loading={!item}
              workspace
              notice={
                view === "issues"
                  ? (item?.reviewNote ??
                    item?.sourceSnapshot?.failureReason ??
                    undefined)
                  : undefined
              }
            />
          ))}
          {!loading && !result.items.length ? (
            <StatePanel
              body="No source-synced papers or datasets match this view."
              title="No research outputs"
            />
          ) : null}
        </WorkspaceCollection>
      ) : null}
      <PaginationControls
        loading={loading}
        onPageChange={setPage}
        page={result?.page ?? page}
        pageSize={result?.pageSize ?? 20}
        total={result?.total}
        totalPages={result?.totalPages ?? 1}
      />
    </div>
  );
}
