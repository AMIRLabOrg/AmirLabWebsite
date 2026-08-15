"use client";

import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { PaginationControls } from "@/components/pagination-controls";
import { SelectControl } from "@/components/ui/select-control";
import { InputControl, TextareaControl } from "@/components/ui/form-controls";
import { FormField } from "@/components/ui/form-field";
import { ButtonAnchor, ButtonControl } from "@/components/ui/button-control";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ToolbarSearchField } from "@/components/ui/toolbar-search-field";
import { ReviewActions } from "@/components/review-actions";
import { StatePanel } from "@/components/state-panel";
import type { PaginatedResponse } from "@/lib/types";
import { useNotifications } from "@/components/notification-provider";

interface ReviewResearch {
  id: string;
  title: string | null;
  summary: string | null;
  canonicalUrl: string | null;
  legacyUrl: string | null;
  type: "PAPER" | "DATASET";
  reviewStatus: "NEEDS_REVIEW" | "CHANGES_REQUESTED" | "PUBLISHED" | "REJECTED";
  paper: {
    citation: string | null;
    doi: string | null;
    publicationType: string | null;
    venue: string | null;
    year: number | null;
  } | null;
  dataset: {
    accessNotes: string | null;
    license: string | null;
    modality: string | null;
    version: string | null;
  } | null;
  sourceSnapshot: {
    status: "PENDING" | "FETCHED" | "UNAVAILABLE" | "FAILED";
    failureReason: string | null;
    fetchedAt: string | null;
    metadata: { authors?: Array<{ name: string; orcid?: string }> } | null;
  } | null;
  contributors: Array<{
    displayName: string;
    sortOrder: number;
    person: { id: string; fullName: string; slug: string } | null;
    matches: Array<{
      id: string;
      confidence: number | null;
      source: "SOURCE_METADATA" | "USER_CLAIM" | "ADMIN_MANUAL";
      status: "PROPOSED" | "VERIFIED" | "REJECTED";
      evidence: { matchReason?: string; orcid?: string } | null;
      person: { id: string; fullName: string; slug: string };
      requestedBy: { email: string | null } | null;
    }>;
    possiblePeople?: Array<{
      id: string;
      fullName: string;
      slug: string;
      reason: string;
    }>;
  }>;
  submittedBy: {
    email: string | null;
    person: { fullName: string } | null;
  } | null;
}

type SourceStatus = NonNullable<ReviewResearch["sourceSnapshot"]>["status"];

interface LinkablePerson {
  id: string;
  fullName: string;
  slug: string;
}

type ResearchDecision = "NEEDS_REVIEW" | "PUBLISHED" | "CHANGES_REQUESTED" | "REJECTED";

function researchLabel(item: ReviewResearch): string {
  return item.title ?? item.paper?.citation ?? "Untitled research item";
}

function proposalReason(
  match: ReviewResearch["contributors"][number]["matches"][number],
): string {
  if (match.evidence?.matchReason) return match.evidence.matchReason;
  if (match.evidence?.orcid) return "ORCID";
  return match.source === "SOURCE_METADATA" ? "Canonical metadata" : "Member claim";
}

function loadingResearchItem(index = 0): ReviewResearch {
  return {
    id: `research-loading-${index}`,
    title: "Loading research submission",
    summary: "Loading submission summary and evidence.",
    canonicalUrl: "#",
    legacyUrl: null,
    type: "PAPER",
    reviewStatus: "NEEDS_REVIEW",
    paper: { citation: "Loading citation", doi: null, publicationType: null, venue: null, year: null },
    dataset: null,
    sourceSnapshot: { status: "PENDING", failureReason: null, fetchedAt: null, metadata: null },
    contributors: Array.from({ length: 4 }, (_, contributorIndex) => ({
      displayName: "Loading contributor",
      sortOrder: contributorIndex,
      person: null,
      matches: [],
      possiblePeople: [],
    })),
    submittedBy: null,
  };
}

export function ResearchReviewQueue({ selectedId }: { selectedId?: string }) {
  const router = useRouter();
  const { refreshUnreadCount, showToast } = useNotifications();
  const [items, setItems] = useState<ReviewResearch[]>([]);
  const [result, setResult] = useState<PaginatedResponse<ReviewResearch>>();
  const [focusedItem, setFocusedItem] = useState<ReviewResearch>();
  const [selected, setSelected] = useState<string | undefined>(selectedId);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("OLDEST");
  const [reload, setReload] = useState(0);
  const [people, setPeople] = useState<LinkablePerson[]>([]);
  const [manualPeople, setManualPeople] = useState<Record<string, string>>({});
  const [relationBusy, setRelationBusy] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [sourcePollTick, setSourcePollTick] = useState(0);

  function beginRefresh() {
    if (result) setLoading(true);
  }

  function changePage(nextPage: number) {
    beginRefresh();
    setPage(nextPage);
  }

  useEffect(() => {
    void apiRequest<LinkablePerson[]>("/research-connections/people", {
      method: "GET",
    }).then(setPeople).catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        sort,
      });
      if (search.trim()) params.set("search", search.trim());
      if (type !== "ALL") params.set("type", type);
      if (status !== "ALL") params.set("status", status);

      setLoading(true);
      setError(undefined);
      const queueRequest = apiRequest<PaginatedResponse<ReviewResearch>>(
        `/research-review?${params}`,
        { method: "GET" },
      );
      const focusRequest = selectedId
        ? apiRequest<ReviewResearch>(`/research-review/${selectedId}`, {
            method: "GET",
          }).catch(() => undefined)
        : Promise.resolve(undefined);

      void Promise.all([queueRequest, focusRequest])
        .then(([queue, focus]) => {
          if (!active) return;
          setResult(queue);
          setItems(queue.items);
          setFocusedItem(focus);
          setSelected((current) => {
            if (focus) return focus.id;
            if (queue.items.some((candidate) => candidate.id === current)) {
              return current;
            }
            return queue.items[0]?.id;
          });
        })
        .catch((caught: unknown) => {
          if (active) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to load research.",
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [page, reload, search, selectedId, sort, status, type]);

  const pendingSourceId = [focusedItem, ...items].find(
    (candidate) => candidate?.sourceSnapshot?.status === "PENDING",
  )?.id;

  useEffect(() => {
    if (!pendingSourceId) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      void apiRequest<ReviewResearch>(`/research-review/${pendingSourceId}`, {
        method: "GET",
      })
        .then((updated) => {
          if (!active) return;
          setItems((current) =>
            current.map((candidate) =>
              candidate.id === updated.id ? updated : candidate,
            ),
          );
          setFocusedItem((current) =>
            current?.id === updated.id ? updated : current,
          );
          if (updated.sourceSnapshot?.status === "PENDING") {
            setSourcePollTick((current) => current + 1);
          }
        })
        .catch(() => {
          if (active) setSourcePollTick((current) => current + 1);
        });
    }, 2500);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [pendingSourceId, sourcePollTick]);

  useEffect(() => {
    setEditing(false);
  }, [selected]);

  async function decide({ note, status }: { note?: string; status: ResearchDecision }) {
    if (!selected) return;
    setError(undefined);
    await apiRequest(`/research/${selected}/review`, {
      body: JSON.stringify({ ...(note ? { note } : {}), status }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (selectedId) {
      router.push("/workspace/research");
      router.refresh();
    } else if (items.length === 1 && page > 1) {
      setPage((current) => current - 1);
    } else {
      setReload((current) => current + 1);
    }
    setSelected(undefined);
    setFocusedItem(undefined);
    void refreshUnreadCount().catch(() => undefined);
  }

  async function saveRecordEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || loadingDetail) return;
    const form = new FormData(event.currentTarget);
    const contributors = String(form.get("contributors") ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (!contributors.length) {
      setError("Add at least one contributor.");
      return;
    }
    setEditSaving(true);
    setError(undefined);
    try {
      const body: Record<string, unknown> = {
        canonicalUrl: form.get("canonicalUrl"),
        contributors,
        summary: form.get("summary") || undefined,
        title: form.get("title"),
        type: item.type,
      };
      if (item.type === "PAPER") {
        body.citation = form.get("citation") || undefined;
        body.doi = form.get("doi") || undefined;
        body.publicationType = form.get("publicationType") || undefined;
        body.venue = form.get("venue") || undefined;
        const year = Number(form.get("year"));
        if (year) body.year = year;
      } else {
        body.accessNotes = form.get("accessNotes") || undefined;
        body.license = form.get("license") || undefined;
        body.modality = form.get("modality") || undefined;
        body.version = form.get("version") || undefined;
      }
      const updated = await apiRequest<ReviewResearch>(`/research/${item.id}`, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      setFocusedItem(updated);
      setItems((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      setEditing(false);
      setReload((current) => current + 1);
      showToast({ body: "The record was returned to manual review and source/contributor verification was restarted.", title: "Research record updated" });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Research record could not be updated.";
      setError(message);
      showToast({ body: message, title: "Research record was not updated", tone: "error" });
    } finally {
      setEditSaving(false);
    }
  }

  async function reviewMatch(id: string, { note, status }: { note?: string; status: "VERIFIED" | "REJECTED" }) {
    setRelationBusy(id);
    setError(undefined);
    try {
      await apiRequest(`/contributor-matches/${id}/review`, {
        body: JSON.stringify({ ...(note ? { note } : {}), status }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      setReload((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection review failed.");
      throw caught;
    } finally {
      setRelationBusy(undefined);
    }
  }

  async function linkContributor(itemId: string, sortOrder: number) {
    const key = `${itemId}:${sortOrder}`;
    const personId = manualPeople[key];
    if (!personId) return;
    setRelationBusy(key);
    setError(undefined);
    try {
      await apiRequest(`/research/${itemId}/contributors/${sortOrder}/link`, {
        body: JSON.stringify({ personId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      setReload((current) => current + 1);
      showToast({ body: "The contributor is now linked to the verified person record.", title: "Contributor linked" });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Manual link failed.";
      setError(message);
      showToast({ body: message, title: "Contributor was not linked", tone: "error" });
    } finally {
      setRelationBusy(undefined);
    }
  }

  async function rediscover(itemId: string) {
    setRelationBusy(`discover:${itemId}`);
    setError(undefined);
    try {
      await apiRequest(`/research/${itemId}/discover`, { method: "POST" });
      const markPending = (candidate: ReviewResearch): ReviewResearch =>
        candidate.id === itemId
          ? {
              ...candidate,
              sourceSnapshot: {
                failureReason: null,
                fetchedAt: candidate.sourceSnapshot?.fetchedAt ?? null,
                metadata: candidate.sourceSnapshot?.metadata ?? null,
                status: "PENDING",
              },
            }
          : candidate;
      setItems((current) => current.map(markPending));
      setFocusedItem((current) =>
        current ? markPending(current) : current,
      );
      showToast({ body: "Canonical source evidence is being checked in the background.", title: "Source check started" });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Source discovery failed.";
      setError(message);
      showToast({ body: message, title: "Source check was not started", tone: "error" });
    } finally {
      setRelationBusy(undefined);
    }
  }

  const visibleItems =
    focusedItem && !items.some((candidate) => candidate.id === focusedItem.id)
      ? [focusedItem, ...items]
      : items;
  const item = visibleItems.find((candidate) => candidate.id === selected) ?? (loading ? loadingResearchItem() : undefined);
  const sourcePending =
    item?.sourceSnapshot?.status === "PENDING" ||
    relationBusy === `discover:${item?.id}`;
  const hasProposedMatches = Boolean(item?.contributors.some((contributor) => contributor.matches.some((match) => match.status === "PROPOSED")));
  const loadingRows = loading;
  const loadingDetail = loading;
  const refreshing = loading && Boolean(result);
  const renderedItems = loadingRows && !visibleItems.length
    ? Array.from({ length: 7 }, (_, index) => loadingResearchItem(index + 1))
    : visibleItems;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 grid-cols-[minmax(220px,1.5fr)_repeat(3,minmax(140px,.7fr))] items-end gap-[.8rem] rounded-panel border border-line bg-surface p-4 max-[980px]:grid-cols-2 max-[640px]:grid-cols-1">
        <ToolbarSearchField
          id="research-review-search"
          label="Search queue"
          onChange={(event) => {
            beginRefresh();
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Title, author, citation, or URL"
          value={search}
        />
        <FormField htmlFor="research-review-type" label="Type">
          <SelectControl
            id="research-review-type"
            onValueChange={(value) => {
              beginRefresh();
              setType(value);
              setPage(1);
            }}
            options={[
              { label: "All types", value: "ALL" },
              { label: "Papers", value: "PAPER" },
              { label: "Datasets", value: "DATASET" },
            ]}
            value={type}
          />
        </FormField>
        <FormField htmlFor="research-review-status" label="Status">
          <SelectControl
            id="research-review-status"
            onValueChange={(value) => {
              beginRefresh();
              setStatus(value);
              setPage(1);
            }}
            options={[
              { label: "Active review", value: "ALL" },
              { label: "Needs review", value: "NEEDS_REVIEW" },
              { label: "Changes requested", value: "CHANGES_REQUESTED" },
              { label: "Published", value: "PUBLISHED" },
              { label: "Rejected", value: "REJECTED" },
            ]}
            value={status}
          />
        </FormField>
        <FormField htmlFor="research-review-sort" label="Sort">
          <SelectControl
            id="research-review-sort"
            onValueChange={(value) => {
              beginRefresh();
              setSort(value);
              setPage(1);
            }}
            options={[
              { label: "Oldest first", value: "OLDEST" },
              { label: "Newest first", value: "NEWEST" },
              { label: "Title A–Z", value: "TITLE" },
            ]}
            value={sort}
          />
        </FormField>
      </div>
      {error && !result && !loading ? (
        <StatePanel
          action={{
            label: "Retry",
            onClick: () => {
              setLoading(true);
              setReload((value) => value + 1);
            },
          }}
          body="The connection dropped. Nothing was lost; reconnect to continue."
          title="Could not load research"
          variant="error"
        />
      ) : (
      <div className="grid min-w-0 grid-cols-[minmax(300px,360px)_minmax(0,1fr)] items-start gap-5 max-[960px]:grid-cols-1">
        <aside className={`sticky top-[88px] grid min-w-0 gap-[.35rem] rounded-panel border border-line bg-surface p-4 max-[960px]:static ${refreshing ? "opacity-70" : ""}`}>
          <div className="grid min-w-0 items-stretch gap-3 border-b border-line pb-[.85rem]">
            <div>
              <p className="m-0 mb-4 font-[var(--font-sans)] text-[.75rem] font-extrabold uppercase tracking-[.12em] text-brand">Review queue</p>
            </div>
            {loading || result ? (
              <PaginationControls
                loading={loading}
                onPageChange={changePage}
                page={result?.page ?? page}
                pageSize={result?.pageSize ?? 20}
                total={result?.total ?? 0}
                totalPages={result?.totalPages ?? 1}
              />
            ) : null}
          </div>
          {renderedItems.length ? (
            <div data-loading={loadingRows || undefined}>
              {renderedItems.map((candidate) => (
                <button
                  className={`grid min-h-[88px] w-full min-w-0 cursor-pointer gap-[.4rem] overflow-hidden rounded-panel border p-[.85rem_.9rem] text-left ${candidate.id === selected ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}
                  disabled={loadingRows}
                  key={candidate.id}
                  onClick={() => setSelected(candidate.id)}
                  type="button"
                >
                  <span className={loadingPlaceholder(loadingRows, "label", "short")} data-placeholder={loadingRows ? "label" : undefined} data-placeholder-width="short">{candidate.type.toLowerCase()}</span>
                  <span className={cn("line-clamp-2 [overflow-wrap:anywhere] font-sans text-[.95rem] font-normal normal-case leading-[1.35] tracking-normal text-ink", loadingPlaceholder(loadingRows, "text", "long"))} data-placeholder={loadingRows ? "text" : undefined} data-placeholder-width="long">{researchLabel(candidate)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="m-0 text-[.82rem] leading-[1.5] text-ink-muted">No submissions match these filters.</p>
          )}
        </aside>
        <section className="grid min-w-0 gap-4 overflow-hidden rounded-panel border border-line bg-surface p-5" data-loading={loadingDetail || undefined}>
          {item ? (
            <>
              <header className="grid gap-[.65rem]">
                <div className="flex flex-wrap items-center gap-[.7rem] text-[.82rem] text-ink-muted">
                  <Badge loading={loadingDetail}>{item.type.toLowerCase()}</Badge>
                  <span className={cn("font-mono text-[.75rem] text-ink-muted", loadingPlaceholder(loadingDetail, "label", "long"))} data-placeholder={loadingDetail ? "label" : undefined} data-placeholder-width="long">
                    Submitted by{" "}
                    {item.submittedBy?.person?.fullName ??
                      item.submittedBy?.email ??
                      "Unknown member"}
                  </span>
                </div>
                <h2 className={cn("m-0 font-serif text-[clamp(1.75rem,2.7vw,2.45rem)] leading-[1.08] [overflow-wrap:anywhere]", loadingPlaceholder(loadingDetail, "text", "full"))} data-placeholder={loadingDetail ? "text" : undefined} data-placeholder-width="full">{researchLabel(item)}</h2>
                {item.summary ? <p className={cn("m-0 text-[.95rem] leading-[1.55] text-ink-muted", loadingPlaceholder(loadingDetail, "text", "full"))} data-placeholder={loadingDetail ? "text" : undefined} data-placeholder-width="full">{item.summary}</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.reviewStatus === "PUBLISHED" ? "field" : item.reviewStatus === "REJECTED" ? "rust" : "gold"}>{item.reviewStatus.replaceAll("_", " ").toLowerCase()}</Badge>
                  <ButtonControl compact disabled={loadingDetail} onClick={() => setEditing((value) => !value)} variant="secondary">{editing ? "Close editor" : "Edit record"}</ButtonControl>
                </div>
              </header>
              {editing ? <ResearchRecordEditor item={item} onSubmit={saveRecordEdit} saving={editSaving} /> : null}
              <section className="grid gap-4 rounded-panel border border-line bg-surface p-[clamp(1rem,2vw,1.35rem)]" aria-label="Source discovery">
                <div className="flex items-center justify-between gap-4 max-[640px]:flex-col max-[640px]:items-start">
                  <div className="flex items-center gap-[.7rem]">
                    <Badge dot loading={loadingDetail} tone={sourceTone(item.sourceSnapshot?.status)}>
                      {item.sourceSnapshot?.status.toLowerCase() ?? "not checked"}
                    </Badge>
                    <h3 className="font-serif text-[clamp(1.15rem,1.7vw,1.35rem)] leading-[1.2]">Canonical source evidence</h3>
                  </div>
                  <ButtonControl compact disabled={sourcePending} loading={loadingDetail} onClick={() => void rediscover(item.id)} variant="secondary">
                    {sourcePending
                      ? "Checking source…"
                      : item.sourceSnapshot
                        ? "Check source again"
                        : "Check source"}
                  </ButtonControl>
                </div>
                {item.sourceSnapshot?.failureReason ? (
                  <p className="m-0 text-[.82rem] leading-[1.5] text-ink-muted">{item.sourceSnapshot.failureReason}</p>
                ) : sourceAuthorsDiffer(item) ? (
                  <div className="grid gap-[.65rem]">
                    <p className="m-0 text-[.75rem] font-semibold text-ink-muted">Source metadata differs</p>
                    <div className="flex flex-wrap gap-[.45rem]">
                      {item.sourceSnapshot?.metadata?.authors?.map(({ name }) => <span className="rounded-full bg-brand-soft px-[.65rem] py-[.4rem] text-[.75rem] text-brand" key={name}>{name}</span>)}
                    </div>
                  </div>
                ) : item.sourceSnapshot?.metadata?.authors?.length ? null : (
                  <p className="m-0 text-[.82rem] leading-[1.5] text-ink-muted">No machine-readable contributor metadata was found. Manual linking remains available.</p>
                )}
              </section>
              <section className="grid gap-4 rounded-panel border border-line bg-surface p-[clamp(1rem,2vw,1.35rem)]" aria-label="Contributor verification">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-serif text-[clamp(1.15rem,1.7vw,1.35rem)] leading-[1.2]">Contributor relationships</h3>
                  <span className={cn("font-mono text-[.75rem] text-ink-muted", loadingPlaceholder(loadingDetail, "label", "medium"))} data-placeholder={loadingDetail ? "label" : undefined} data-placeholder-width="medium">{item.contributors.filter(({ person }) => person).length}/{item.contributors.length} linked</span>
                </div>
                {item.contributors.map((contributor) => {
                  const key = `${item.id}:${contributor.sortOrder}`;
                  const proposals = contributor.matches.filter(({ status }) => status === "PROPOSED");
                  const hints = contributor.possiblePeople ?? [];
                  return (
                    <article className="grid grid-cols-[minmax(220px,.8fr)_minmax(0,1.2fr)] gap-x-4 gap-y-[.85rem] border-t border-line pt-4 first:border-t-0 first:pt-0 max-[700px]:grid-cols-1" key={key}>
                      <div className="flex min-w-0 items-baseline gap-[.7rem]">
                        <span className={cn("font-mono text-[.75rem] text-ink-muted", loadingPlaceholder(loadingDetail, "label"))} data-placeholder={loadingDetail ? "label" : undefined}>{String(contributor.sortOrder + 1).padStart(2, "0")}</span>
                        <strong className={loadingPlaceholder(loadingDetail, "text", "long")} data-placeholder={loadingDetail ? "text" : undefined} data-placeholder-width="long">{contributor.displayName}</strong>
                      </div>
                      {contributor.person ? (
                        <div className="flex min-w-0 items-center justify-between gap-[.8rem] bg-transparent px-1 py-[.45rem]">
                          <Badge dot tone="field">Verified</Badge>
                          <strong>{contributor.person.fullName}</strong>
                        </div>
                      ) : (
                        <>
                          {proposals.map((match) => (
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center justify-between gap-[.8rem] rounded-panel border border-[color-mix(in_srgb,var(--gold)_24%,var(--line))] bg-[color-mix(in_srgb,var(--gold-soft)_52%,var(--surface))] p-[.85rem] max-[700px]:grid-cols-1" key={match.id}>
                              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-[.55rem] gap-y-1">
                                <Badge dot tone="gold">Proposed</Badge>
                                <strong className="text-base leading-[1.35] [overflow-wrap:anywhere]">{match.person.fullName}</strong>
                                <small className="col-start-2 text-[.82rem] leading-[1.45] text-ink-muted">
                                  {proposalReason(match)}
                                  {match.confidence ? ` · ${Math.round(match.confidence * 100)}% match` : ""}
                                </small>
                              </div>
                              <ReviewActions
                                className="gap-[.55rem]"
                                actions={[
                                  {
                                    confirmDescription: `Link ${match.person.fullName} to this contributor.`,
                                    confirmLabel: "Verify link",
                                    confirmTitle: "Verify this contributor link?",
                                    disabled: relationBusy === match.id,
                                    label: "Verify",
                                    status: "VERIFIED",
                                    tone: "primary",
                                  },
                                  {
                                    confirmDescription: "Reject this proposed contributor link with a reviewer note.",
                                    confirmLabel: "Reject link",
                                    confirmTitle: "Reject this contributor link?",
                                    disabled: relationBusy === match.id,
                                    label: "Reject",
                                    notePlaceholder: "Explain why this contributor link was rejected.",
                                    requiresNote: true,
                                    status: "REJECTED",
                                    tone: "secondary",
                                  },
                                ]}
                                onSubmit={(decision) => reviewMatch(match.id, decision)}
                                successBody={(status) => `The contributor match was ${status.toLowerCase()}.`}
                                successTitle="Contributor link reviewed"
                              />
                            </div>
                          ))}
                          {hints.length ? (
                            <div className="flex flex-wrap gap-2">
                              {hints.map((person) => (
                                <button
                                  className="inline-flex cursor-pointer items-center gap-[.45rem] rounded-full border border-line bg-canvas px-[.7rem] py-[.45rem] text-ink hover:border-brand"
                                  key={person.id}
                                  onClick={() =>
                                    setManualPeople((current) => ({
                                      ...current,
                                      [key]: person.id,
                                    }))
                                  }
                                  type="button"
                                >
                                  <strong className="text-[.82rem]">{person.fullName}</strong>
                                  <span className="text-[.76rem] text-ink-muted">{person.reason}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-[.6rem] max-[640px]:grid-cols-1">
                            <SearchableSelect
                              aria-label={`Link ${contributor.displayName} manually`}
                              disabled={loadingDetail}
                              placeholderLoading={loadingDetail}
                              onValueChange={(value) =>
                                setManualPeople((current) => ({ ...current, [key]: value }))
                              }
                              options={people.map((person) => ({
                                label: person.fullName,
                                value: person.id,
                              }))}
                              placeholder="Select registered person…"
                              searchPlaceholder="Search people…"
                              value={manualPeople[key] ?? ""}
                            />
                            <ButtonControl compact disabled={!manualPeople[key] || relationBusy === key} loading={loadingDetail} onClick={() => void linkContributor(item.id, contributor.sortOrder)} variant="secondary">
                              Verify manual link
                            </ButtonControl>
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </section>
              {(item.canonicalUrl ?? item.legacyUrl) ? (
                <ButtonAnchor className="justify-self-start" href={loadingDetail ? "#" : (item.canonicalUrl ?? item.legacyUrl ?? undefined)} loading={loadingDetail} rel="noreferrer" target="_blank" variant="secondary">
                  Verify source
                </ButtonAnchor>
              ) : (
                <p className="m-0 text-[.82rem] leading-[1.5] text-ink-muted">
                  No external source URL was present in the archive.
                </p>
              )}
              {error ? <p className="m-0 flex items-center gap-[.45rem] text-[.82rem] leading-[1.5] text-ink-muted rounded-panel bg-danger-soft p-[.8rem] text-danger">{error}</p> : null}
              {item.reviewStatus === "PUBLISHED" || item.reviewStatus === "REJECTED" ? (
                <ReviewActions
                  loading={loadingDetail}
                  actions={[{
                    confirmDescription: "The public/rejected decision is retained in history and the record returns to the manual verification queue.",
                    confirmLabel: "Reopen record",
                    confirmTitle: "Reopen this research record?",
                    label: "Reopen for review",
                    notePlaceholder: "Explain why this record needs to be reviewed again.",
                    requiresNote: true,
                    status: "NEEDS_REVIEW",
                    tone: "secondary",
                  }]}
                  onSubmit={loadingDetail ? () => Promise.resolve() : decide}
                  successBody={() => "The record was reopened for manual review."}
                  successTitle="Research record reopened"
                />
              ) : (
                <ReviewActions
                  loading={loadingDetail}
                  actions={[
                    {
                      confirmDescription: "The record becomes public and a verified paper may trigger rank promotion.",
                      confirmLabel: "Publish verified record",
                      confirmTitle: "Publish this research record?",
                      disabled: sourcePending || hasProposedMatches,
                      label: sourcePending ? "Source check in progress" : hasProposedMatches ? "Resolve contributor matches" : "Publish",
                      status: "PUBLISHED",
                      tone: "primary",
                    },
                    {
                      confirmDescription: "The submission returns to the member with your reviewer note.",
                      confirmLabel: "Request changes",
                      confirmTitle: "Send this back for changes?",
                      label: "Add review",
                      notePlaceholder: "Explain what must change before this can be approved.",
                      pendingLabel: "Send review",
                      requiresNote: true,
                      status: "CHANGES_REQUESTED",
                      tone: "secondary",
                    },
                    {
                      confirmDescription: "The submission leaves the active queue as rejected.",
                      confirmLabel: "Reject submission",
                      confirmTitle: "Reject this research record?",
                      label: "Reject",
                      notePlaceholder: "Explain why this submission was rejected.",
                      requiresNote: true,
                      status: "REJECTED",
                      tone: "danger",
                    },
                  ]}
                  onSubmit={loadingDetail ? () => Promise.resolve() : decide}
                  successBody={(status) => `The research record was moved to ${status.replaceAll("_", " ").toLowerCase()}.`}
                  successTitle="Research review saved"
                />
              )}
            </>
          ) : (
            <p className="m-0 text-[.82rem] leading-[1.5] text-ink-muted">Select a research submission.</p>
          )}
        </section>
      </div>
      )}
    </div>
  );
}

function ResearchRecordEditor({ item, onSubmit, saving }: { item: ReviewResearch; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  return (
    <form className="grid gap-4 rounded-panel border border-line-strong bg-canvas p-[clamp(1rem,2vw,1.35rem)]" onSubmit={onSubmit}>
      <div className="grid gap-1">
        <span className="font-mono text-[.62rem] uppercase tracking-[.08em] text-brand">Record editor</span>
        <strong className="font-serif text-[1.2rem] font-normal">Edit and re-run verification</strong>
        <p className="m-0 text-[.78rem] leading-[1.5] text-ink-muted">Saving changes returns the record to Needs review and restarts canonical-source and contributor matching.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
        <FormField className="col-span-full" htmlFor="review-edit-title" label="Title"><InputControl defaultValue={item.title ?? ""} id="review-edit-title" name="title" required /></FormField>
        <FormField className="col-span-full" htmlFor="review-edit-url" label="Canonical URL"><InputControl defaultValue={item.canonicalUrl ?? item.legacyUrl ?? ""} id="review-edit-url" name="canonicalUrl" required type="url" /></FormField>
        <FormField className="col-span-full" htmlFor="review-edit-contributors" label="Contributors"><TextareaControl defaultValue={item.contributors.map(({ displayName }) => displayName).join(", ")} id="review-edit-contributors" name="contributors" required rows={2} /></FormField>
        <FormField className="col-span-full" htmlFor="review-edit-summary" label="Summary"><TextareaControl defaultValue={item.summary ?? ""} id="review-edit-summary" name="summary" rows={3} /></FormField>
        {item.type === "PAPER" ? (<>
          <FormField htmlFor="review-edit-doi" label="DOI"><InputControl defaultValue={item.paper?.doi ?? ""} id="review-edit-doi" name="doi" /></FormField>
          <FormField htmlFor="review-edit-year" label="Year"><InputControl defaultValue={item.paper?.year?.toString() ?? ""} id="review-edit-year" max="2200" min="1900" name="year" type="number" /></FormField>
          <FormField htmlFor="review-edit-venue" label="Venue"><InputControl defaultValue={item.paper?.venue ?? ""} id="review-edit-venue" name="venue" /></FormField>
          <FormField htmlFor="review-edit-publication-type" label="Publication type"><InputControl defaultValue={item.paper?.publicationType ?? ""} id="review-edit-publication-type" name="publicationType" /></FormField>
          <FormField className="col-span-full" htmlFor="review-edit-citation" label="Citation"><TextareaControl defaultValue={item.paper?.citation ?? ""} id="review-edit-citation" name="citation" rows={3} /></FormField>
        </>) : (<>
          <FormField htmlFor="review-edit-version" label="Version"><InputControl defaultValue={item.dataset?.version ?? ""} id="review-edit-version" name="version" /></FormField>
          <FormField htmlFor="review-edit-license" label="License"><InputControl defaultValue={item.dataset?.license ?? ""} id="review-edit-license" name="license" /></FormField>
          <FormField htmlFor="review-edit-modality" label="Modality"><InputControl defaultValue={item.dataset?.modality ?? ""} id="review-edit-modality" name="modality" /></FormField>
          <FormField className="col-span-full" htmlFor="review-edit-access" label="Access notes"><TextareaControl defaultValue={item.dataset?.accessNotes ?? ""} id="review-edit-access" name="accessNotes" rows={3} /></FormField>
        </>)}
      </div>
      <div className="flex justify-end"><ButtonControl disabled={saving} type="submit" variant="primary">{saving ? "Saving…" : "Save and re-run review"}</ButtonControl></div>
    </form>
  );
}

function sourceTone(status: SourceStatus | undefined): BadgeTone {
  if (status === "FETCHED") return "field";
  if (status === "PENDING") return "gold";
  return "rust";
}

function sourceAuthorsDiffer(item: ReviewResearch): boolean {
  const source = item.sourceSnapshot?.metadata?.authors?.map(({ name }) => normalizeName(name)) ?? [];
  const contributors = item.contributors.map(({ displayName }) => normalizeName(displayName));
  return source.length > 0 && (source.length !== contributors.length || source.some((name, index) => name !== contributors[index]));
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
