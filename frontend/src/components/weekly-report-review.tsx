"use client";

import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { StatePanel } from "@/components/state-panel";
import { Badge } from "@/components/ui/badge";
import { ButtonControl } from "@/components/ui/button-control";
import { TabsControl } from "@/components/ui/tabs-control";
import { TextareaControl } from "@/components/ui/form-controls";
import { FormField } from "@/components/ui/form-field";
import {
  WorkspaceEmpty,
  WorkspaceHero,
  WorkspacePanel,
  WorkspaceSplit,
  WorkspaceSurface,
} from "@/components/ui/workspace-surface";
import { apiRequest } from "@/lib/client-api";
import {
  reportStatusLabel,
  reportWeek,
  type WeeklyReport,
  type WeeklyReportStatus,
} from "@/lib/weekly-reports";
import { statusTone } from "./weekly-reports";

const filters = [
  { label: "Awaiting review", value: "SUBMITTED" },
  { label: "Changes requested", value: "CHANGES_REQUESTED" },
  { label: "Reviewed", value: "REVIEWED" },
];

export function WeeklyReportReview() {
  const [reports, setReports] = useState<WeeklyReport[]>();
  const [filter, setFilter] = useState<WeeklyReportStatus>("SUBMITTED");
  const [selectedId, setSelectedId] = useState<string>();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest<WeeklyReport[]>("/weekly-reports/review-queue", { method: "GET" })
      .then((result) => {
        if (!active) return;
        setReports(result);
        setSelectedId((current) => current ?? result.find(({ status }) => status === "SUBMITTED")?.id);
        setError("");
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Weekly reports could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const visible = useMemo(() => reports?.filter(({ status }) => status === filter) ?? [], [filter, reports]);
  const selected = reports?.find(({ id }) => id === selectedId);
  const options = filters.map((option) => ({
    ...option,
    count: reports?.filter(({ status }) => status === option.value).length ?? 0,
  }));

  async function review(status: "CHANGES_REQUESTED" | "REVIEWED") {
    if (!selected) return;
    if (status === "CHANGES_REQUESTED" && !note.trim()) {
      setError("Explain what the researcher must change.");
      return;
    }
    setWorking(true);
    try {
      const updated = await apiRequest<WeeklyReport>(`/weekly-reports/${selected.id}/review`, {
        body: JSON.stringify({ note, status }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      setReports((current) => current?.map((report) => (report.id === updated.id ? updated : report)));
      setFilter(status);
      setNote("");
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The review decision could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <WorkspaceSurface measure="reading">
      <WorkspaceHero
        description="Review project-linked evidence, surface blockers, and return specific guidance without turning weekly reporting into a ranking contest."
        eyebrow="Review · research cadence"
        meta={<span>{reports?.filter(({ status }) => status === "SUBMITTED").length ?? "—"} awaiting review</span>}
        title="Weekly report review"
      />

      {error ? (
        <StatePanel
          action={!reports ? { label: "Try again", onClick: () => setReload((value) => value + 1) } : undefined}
          body={error}
          title="Weekly report review needs attention"
          variant="error"
        />
      ) : null}

      <TabsControl
        ariaLabel="Filter weekly reports"
        onValueChange={(value) => {
          const status = value as WeeklyReportStatus;
          setFilter(status);
          setSelectedId(reports?.find((report) => report.status === status)?.id);
          setNote("");
        }}
        options={options}
        value={filter}
      />

      <WorkspaceSplit>
        <WorkspacePanel description="Select a report to inspect its evidence and plan." eyebrow="Queue" title={filters.find(({ value }) => value === filter)?.label ?? "Reports"}>
          <div
            aria-busy={!reports}
            className="grid"
            data-loading={!reports || undefined}
          >
            {(reports ? visible : Array.from({ length: 3 }, () => undefined)).map((report, index) => (
              <ButtonControl
                aria-pressed={Boolean(report && selectedId === report.id)}
                className="min-h-[74px] w-full justify-between rounded-none border-0 border-b border-line px-6 py-4 text-left hover:bg-brand-faint aria-pressed:bg-brand-faint aria-pressed:text-ink"
                key={report?.id ?? `weekly-review-loading-${index}`}
                loading={!report}
                onClick={report ? () => {
                  setSelectedId(report.id);
                  setNote(report.reviewNote ?? "");
                } : undefined}
                variant="secondary"
              >
                <span className="grid gap-1">
                  <strong className={loadingPlaceholder(!report, "text", "long")} data-placeholder={!report ? "text" : undefined} data-placeholder-width="long">{report?.author.person?.fullName ?? report?.author.email ?? "Researcher name"}</strong>
                  <small className={cn("text-[.7rem] text-ink-muted", loadingPlaceholder(!report, "label", "medium"))} data-placeholder={!report ? "label" : undefined} data-placeholder-width="medium">{report ? reportWeek(report.weekStart) : "Reporting week"}</small>
                </span>
                <Badge loading={!report} tone={report ? statusTone(report.status) : "neutral"}>{report ? reportStatusLabel(report.status) : "Submitted"}</Badge>
              </ButtonControl>
            ))}
            {reports && visible.length === 0 ? (
              <WorkspaceEmpty>No reports match this review state.</WorkspaceEmpty>
            ) : null}
          </div>
        </WorkspacePanel>

        <WorkspacePanel description="Review outcomes and blockers in the context of the projects covered." eyebrow="Report detail" title={selected ? selected.author.person?.fullName ?? selected.author.email ?? "Weekly report" : "Select a report"}>
          {!reports || selected ? (
            <div className="grid gap-0" data-loading={!reports || undefined}>
              <ReportSection label="Projects" loading={!reports} value={selected ? selected.projects.map(({ project }) => project.researchItem.title ?? "Untitled project").join(" · ") : "Linked research projects"} />
              <ReportSection
                label="Evidence outputs"
                loading={!reports}
                value={selected
                  ? selected.outputs.length
                    ? selected.outputs.map(({ output }) => `${output.title ?? "Untitled output"} (${output.type === "PAPER" ? "paper" : "dataset"})`).join(" · ")
                    : "No paper or dataset linked."
                  : "Linked papers and datasets"}
              />
              <ReportSection label="Completed work and evidence" loading={!reports} value={selected?.accomplishments ?? "Research outcomes and evidence from the reporting week."} />
              <ReportSection label="Blockers and decisions needed" loading={!reports} value={selected ? selected.blockers || "No blockers reported." : "Constraints and decisions that need supervisor attention."} />
              <ReportSection label="Plan for next week" loading={!reports} value={selected?.nextWeekPlan ?? "Expected research outcomes for the next reporting week."} />
              {selected?.status === "SUBMITTED" ? (
                <div className="grid gap-4 border-t border-line px-6 py-5 max-[640px]:p-5">
                  <FormField htmlFor="weekly-review-note" label="Supervisor note" labelClassName="text-[.78rem] font-semibold tracking-[.04em]">
                    <TextareaControl
                      id="weekly-review-note"
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Acknowledge progress or explain a required change."
                      value={note}
                    />
                  </FormField>
                  <div className="flex flex-wrap justify-end gap-3 max-[640px]:grid max-[640px]:grid-cols-1">
                    <ButtonControl disabled={working} onClick={() => void review("CHANGES_REQUESTED")} variant="secondary">
                      <RotateCcw aria-hidden="true" size={16} /> Request changes
                    </ButtonControl>
                    <ButtonControl disabled={working} onClick={() => void review("REVIEWED")} variant="primary">
                      <CheckCircle2 aria-hidden="true" size={16} /> Mark reviewed
                    </ButtonControl>
                  </div>
                </div>
              ) : selected?.reviewNote ? (
                <ReportSection label="Supervisor note" value={selected.reviewNote} />
              ) : null}
            </div>
          ) : (
            <WorkspaceEmpty>Select a report from the queue.</WorkspaceEmpty>
          )}
        </WorkspacePanel>
      </WorkspaceSplit>
    </WorkspaceSurface>
  );
}

function ReportSection({ label, value, loading = false }: { label: string; value: string; loading?: boolean }) {
  return (
    <section className="border-t border-line px-6 py-5 first:border-t-0 max-[640px]:p-5">
      <strong className="text-[.76rem] tracking-[.04em]">{label}</strong>
      <p className={cn("mt-2 whitespace-pre-wrap leading-[1.55] text-ink-muted", loadingPlaceholder(loading, "text", "full"))} data-placeholder={loading ? "text" : undefined} data-placeholder-width="full">{value}</p>
    </section>
  );
}
