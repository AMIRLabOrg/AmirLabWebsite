"use client";

import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { useEffect, useState } from "react";
import { StatePanel } from "@/components/state-panel";
import { Badge } from "@/components/ui/badge";
import { ButtonAnchor } from "@/components/ui/button-control";
import { ReviewActions } from "@/components/review-actions";
import { apiRequest } from "@/lib/client-api";

interface ChangeRequest {
  id: string;
  kind: string;
  payload: unknown;
  submittedAt: string;
  submittedBy: { email: string | null; person: { fullName: string } | null };
  project: { researchItem: { title: string | null } };
}

export function ProjectReviewQueue() {
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const loaded = !loading && !error;

  function load() {
    setLoading(true);
    return apiRequest<ChangeRequest[]>("/project-change-reviews", { method: "GET" })
      .then((nextItems) => {
        setItems(nextItems);
        setError("");
      })
      .catch((value: Error) => setError(value.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    void apiRequest<ChangeRequest[]>("/project-change-reviews", { method: "GET" })
      .then((nextItems) => {
        if (active) setItems(nextItems);
      })
      .catch((value: Error) => {
        if (active) setError(value.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function decide(id: string, { note, status }: { note?: string; status: "APPROVED" | "REJECTED" }) {
    await apiRequest(`/project-change-reviews/${id}/review`, {
      body: JSON.stringify({ ...(note ? { note } : {}), status }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    await load();
  }

  return (
    <section className="grid min-w-0 gap-4">
      <div className="flex items-center justify-between gap-4 rounded-panel border border-line bg-surface p-5 max-[640px]:flex-col max-[640px]:items-start">
        <div>
          <p className="m-0 mb-4 font-[var(--font-sans)] text-[.75rem] font-extrabold uppercase tracking-[.12em] text-brand">Review queue</p>
          <h2 className="mt-[.35rem] font-serif text-[clamp(1.5rem,2.6vw,2.2rem)] font-normal leading-[1.05]">Project change moderation</h2>
          <p className="mt-[.55rem] max-w-[720px] text-[.82rem] leading-[1.55] text-ink-muted">Review member-submitted changes to milestones, team records, outputs, resources, and project settings before they publish.</p>
        </div>
        <Badge loading={loading}>{loading ? "Loading" : `${items.length} pending`}</Badge>
      </div>

      {error && items.length ? <p className="m-0 flex items-center gap-[.45rem] text-[.82rem] leading-[1.5] text-ink-muted rounded-panel bg-danger-soft p-[.8rem] text-danger">{error}</p> : null}

      <div className="grid min-w-0 gap-4" data-loading={loading || undefined}>
        {error && !items.length && !loading ? (
          <StatePanel
            action={{ label: "Retry", onClick: () => void load() }}
            body="The connection dropped. Nothing was lost; reconnect to continue."
            title="Could not load project changes"
            variant="error"
          />
        ) : null}

        {loading || loaded
          ? (loading && !items.length
              ? Array.from({ length: 4 }, () => undefined)
              : items
            ).map((item, index) => (
              <article className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-5 rounded-panel border border-line bg-surface p-[clamp(1rem,2vw,1.4rem)] max-[640px]:grid-cols-1" key={item?.id ?? `project-review-loading-${index}`}>
                <div className="grid min-w-0 gap-[.55rem]">
                  <span className={cn("font-mono text-[.68rem] uppercase tracking-[.08em] text-brand", loadingPlaceholder(loading, "label", "medium"))} data-placeholder="label" data-placeholder-width="medium">{item?.kind.replaceAll("_", " ") ?? "Loading change type"}</span>
                  <h2 className={cn("font-serif text-[clamp(1.35rem,2.4vw,2.1rem)] font-[430] leading-[1.08] [overflow-wrap:anywhere]", loadingPlaceholder(loading, "text", "long"))} data-placeholder="text" data-placeholder-width="long">{item?.project.researchItem.title ?? "Loading project title"}</h2>
                  <p className={cn("m-0 text-[.86rem] text-ink-muted", loadingPlaceholder(loading, "text", "full"))} data-placeholder="text" data-placeholder-width="full">
                    {item ? <>Submitted by {item.submittedBy.person?.fullName ?? item.submittedBy.email ?? "member"} ·{" "}{new Date(item.submittedAt).toLocaleString()}</> : "Loading submission provenance"}
                  </p>
                  <section className="mt-[.4rem] grid gap-3 border-t border-line pt-[.8rem]" aria-label="Proposed project changes">
                    <h3 className={cn("text-[.82rem] font-[750]", loadingPlaceholder(loading, "label"))} data-placeholder={loading ? "label" : undefined}>Proposed changes</h3>
                    {item ? <ProjectChangePreview kind={item.kind} payload={item.payload} /> : <div className={loadingPlaceholder(true, "text", "full")} data-placeholder="text" data-placeholder-width="full">Loading proposed changes</div>}
                  </section>
                </div>
                <ReviewActions
                  loading={loading}
                  actions={[
                    {
                      confirmDescription: "Apply this project change and publish it to the workspace record.",
                      confirmLabel: "Approve change",
                      confirmTitle: "Approve this project change?",
                      label: "Approve",
                      status: "APPROVED",
                      tone: "primary",
                    },
                    {
                      confirmDescription: "Reject this project change and show the reviewer note to the submitting member.",
                      confirmLabel: "Reject change",
                      confirmTitle: "Reject this project change?",
                      label: "Reject",
                      notePlaceholder: "Explain why this project change was rejected.",
                      requiresNote: true,
                      status: "REJECTED",
                      tone: "danger",
                    },
                  ]}
                  onSubmit={(decision) => item ? decide(item.id, decision) : Promise.resolve()}
                  successBody={(status) => `The project change was ${status.toLowerCase()}.`}
                  successTitle="Project review saved"
                />
              </article>
            ))
          : null}

        {loaded && !items.length ? (
          <StatePanel
            action={{ href: "/workspace/projects", label: "View projects" }}
            body="Project edits that require manual review will appear here. Automatic project changes continue to publish directly based on the current policy."
            title="Project change queue is clear"
            variant="empty"
          />
        ) : null}
      </div>
    </section>
  );
}

function ProjectChangePreview({ kind, payload }: { kind: string; payload: unknown }) {
  const record = asRecord(payload);
  const entries = Object.entries(record).filter(
    ([key]) => key !== "publishNow" && key !== "overrideReason",
  );

  if (kind === "ARCHIVE") {
    return (
      <div className="rounded-panel border border-danger/25 bg-danger-soft p-4 text-[.82rem] leading-[1.55] text-danger">
        Archive this project and remove its public project page.
      </div>
    );
  }

  if (!entries.length) {
    return <p className="m-0 text-[.8rem] text-ink-muted">No additional values were submitted with this change.</p>;
  }

  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-panel bg-surface-subtle p-4 max-[700px]:grid-cols-1">
      {entries.map(([key, value]) => (
        <ProjectChangeField key={key} label={humanizeKey(key)} value={value} />
      ))}
    </dl>
  );
}

function ProjectChangeField({ label, value }: { label: string; value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <div className="col-span-full grid gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
        <dt className="font-mono text-[.62rem] font-semibold uppercase tracking-[.07em] text-ink-muted">{label}</dt>
        <dd className="m-0 grid gap-2">
          {value.length ? value.map((entry, index) => (
            <ProjectChangeListEntry entry={entry} index={index} key={index} />
          )) : <span className="text-[.78rem] text-ink-muted">None</span>}
        </dd>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 content-start gap-1 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <dt className="font-mono text-[.62rem] font-semibold uppercase tracking-[.07em] text-ink-muted">{label}</dt>
      <dd className="m-0 min-w-0 text-[.82rem] leading-[1.5] [overflow-wrap:anywhere]">{renderProjectChangeValue(value)}</dd>
    </div>
  );
}

function ProjectChangeListEntry({ entry, index }: { entry: unknown; index: number }) {
  if (!entry || Array.isArray(entry) || typeof entry !== "object") {
    return <div className="rounded-control border border-line bg-surface px-3 py-2 text-[.78rem]">{renderProjectChangeValue(entry)}</div>;
  }
  const record = entry as Record<string, unknown>;
  const heading = stringValue(record.title) ?? stringValue(record.label) ?? `Item ${index + 1}`;
  const entries = Object.entries(record).filter(([key]) => key !== "title" && key !== "label" && key !== "id");
  return (
    <article className="grid gap-2 rounded-control border border-line bg-surface p-3">
      <strong className="text-[.84rem]">{heading}</strong>
      {entries.length ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 max-[640px]:grid-cols-1">
          {entries.map(([key, value]) => (
            <div className="grid gap-[.15rem]" key={key}>
              <dt className="font-mono text-[.58rem] uppercase tracking-[.05em] text-ink-muted">{humanizeKey(key)}</dt>
              <dd className="m-0 text-[.76rem] leading-[1.45] [overflow-wrap:anywhere]">{renderProjectChangeValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

function renderProjectChangeValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-ink-muted">Not set</span>;
  }
  if (typeof value === "boolean") {
    return <Badge tone={value ? "field" : "neutral"}>{value ? "Enabled" : "Disabled"}</Badge>;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) {
      return <ButtonAnchor compact href={value} rel="noreferrer" target="_blank" variant="ghost">Open link</ButtonAnchor>;
    }
    if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toLocaleString();
    }
    if (/^[A-Z][A-Z0-9_]+$/.test(value)) {
      return value.replaceAll("_", " ").toLowerCase();
    }
    return value;
  }
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length ? entries.map(([key, item]) => `${humanizeKey(key)}: ${plainProjectChangeValue(item)}`).join(" · ") : "None";
  }
  return String(value);
}

function plainProjectChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (typeof value === "string" && /^[A-Z][A-Z0-9_]+$/.test(value)) return value.replaceAll("_", " ").toLowerCase();
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && !Array.isArray(value) && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function humanizeKey(value: string): string {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase() : value;
}
