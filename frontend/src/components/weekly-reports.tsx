"use client";

import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { useEffect, useState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { StatePanel } from "@/components/state-panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonControl } from "@/components/ui/button-control";
import { CheckboxControl } from "@/components/ui/checkbox-control";
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
  type WeeklyReportContext,
  type WeeklyReportStatus,
} from "@/lib/weekly-reports";

export function WeeklyReports() {
  const [context, setContext] = useState<WeeklyReportContext>();
  const [history, setHistory] = useState<WeeklyReport[]>();
  const [accomplishments, setAccomplishments] = useState("");
  const [blockers, setBlockers] = useState("");
  const [nextWeekPlan, setNextWeekPlan] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [outputIds, setOutputIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState<"save" | "submit">();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<WeeklyReportContext>("/weekly-reports/current", { method: "GET" }),
      apiRequest<WeeklyReport[]>("/weekly-reports/mine", { method: "GET" }),
    ])
      .then(([current, reports]) => {
        if (!active) return;
        setContext(current);
        setHistory(reports);
        setAccomplishments(current.report?.accomplishments ?? "");
        setBlockers(current.report?.blockers ?? "");
        setNextWeekPlan(current.report?.nextWeekPlan ?? "");
        setProjectIds(current.report?.projects.map(({ projectId }) => projectId) ?? []);
        setOutputIds(current.report?.outputs.map(({ outputId }) => outputId) ?? []);
        setError("");
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Weekly reports could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const currentReport = context?.report;
  const editable = Boolean(context) && (!currentReport || ["DRAFT", "CHANGES_REQUESTED"].includes(currentReport.status));

  async function save() {
    if (!projectIds.length) {
      setError("Select at least one project for this report.");
      return null;
    }
    const report = await apiRequest<WeeklyReport>("/weekly-reports/current", {
      body: JSON.stringify({ accomplishments, blockers, nextWeekPlan, outputIds, projectIds }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
    setContext((current) => (current ? { ...current, report } : current));
    setHistory((current) => [report, ...(current ?? []).filter(({ id }) => id !== report.id)]);
    setError("");
    return report;
  }

  async function saveDraft() {
    setWorking("save");
    try {
      await save();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The weekly report could not be saved.");
    } finally {
      setWorking(undefined);
    }
  }

  async function submitReport() {
    setWorking("submit");
    try {
      const saved = await save();
      if (!saved) return;
      const report = await apiRequest<WeeklyReport>("/weekly-reports/current/submit", {
        method: "POST",
      });
      setContext((current) => (current ? { ...current, report } : current));
      setHistory((current) => [report, ...(current ?? []).filter(({ id }) => id !== report.id)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The weekly report could not be submitted.");
    } finally {
      setWorking(undefined);
    }
  }

  return (
    <WorkspaceSurface measure="reading">
      <WorkspaceHero
        description="Connect this week’s evidence to active projects, record blockers early, and give supervisors a clear next-step plan."
        eyebrow="My work · weekly rhythm"
        meta={<span>{context ? reportWeek(context.weekStart) : "Current reporting week"}</span>}
        title="Weekly report"
      />

      {error ? (
        <StatePanel
          action={!context ? { label: "Try again", onClick: () => setReload((value) => value + 1) } : undefined}
          body={error}
          title={context ? "Report not saved" : "Could not load weekly reporting"}
          variant="error"
        />
      ) : null}

      <WorkspaceSplit>
        <WorkspacePanel
          action={currentReport ? <Badge tone={statusTone(currentReport.status)}>{reportStatusLabel(currentReport.status)}</Badge> : null}
          description="Use concrete outcomes and decisions. Project task counts are supplied by the system as context."
          eyebrow="Current week"
          title="Research update"
        >
          <form
              aria-busy={!context}
              className="grid gap-6 p-6 max-[640px]:p-5"
              data-loading={!context || undefined}
             
              onSubmit={(event) => {
                event.preventDefault();
                void saveDraft();
              }}
            >
              {currentReport?.reviewNote ? (
                <div className="rounded-small border-l-[3px] border-review bg-review-soft p-4 text-ink">
                  <strong className="text-[.76rem] tracking-[.04em]">Supervisor note</strong>
                  <p className="mt-2 whitespace-pre-wrap leading-[1.55] text-ink-muted">{currentReport.reviewNote}</p>
                </div>
              ) : null}
              <FormField htmlFor="weekly-accomplishments" label="Completed work and evidence" labelClassName="text-[.78rem] font-semibold tracking-[.04em]">
                <TextareaControl loading={!context}
                  disabled={!editable}
                  id="weekly-accomplishments"
                  maxLength={12_000}
                  onChange={(event) => setAccomplishments(event.target.value)}
                  placeholder="What moved forward? Include results, decisions, completed experiments, drafts, or task outcomes."
                  required
                  value={accomplishments}
                />
              </FormField>
              <FormField htmlFor="weekly-blockers" label="Blockers and decisions needed" labelClassName="text-[.78rem] font-semibold tracking-[.04em]">
                <TextareaControl loading={!context}
                  disabled={!editable}
                  id="weekly-blockers"
                  maxLength={8_000}
                  onChange={(event) => setBlockers(event.target.value)}
                  placeholder="Name the constraint, its impact, and who can unblock it. Leave empty when there are no blockers."
                  value={blockers}
                />
              </FormField>
              <FormField htmlFor="weekly-next-plan" label="Plan for next week" labelClassName="text-[.78rem] font-semibold tracking-[.04em]">
                <TextareaControl loading={!context}
                  disabled={!editable}
                  id="weekly-next-plan"
                  maxLength={12_000}
                  onChange={(event) => setNextWeekPlan(event.target.value)}
                  placeholder="List the outcomes you expect to complete next—not a generic activity list."
                  required
                  value={nextWeekPlan}
                />
              </FormField>

              <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0" disabled={!editable}>
                <legend className="mb-3 text-[.78rem] font-semibold tracking-[.04em]">Projects covered by this report</legend>
                {(!context || context.projects.length
                  ? (context?.projects ?? Array.from({ length: 2 }, () => undefined)).map((project, index) => (
                      <CheckboxControl
                        checked={project ? projectIds.includes(project.id) : false}
                        disabled={!context}
                        id={project ? `weekly-project-${project.id}` : `weekly-project-loading-${index}`}
                        key={project?.id ?? `weekly-project-loading-${index}`}
                        loading={!project}
                        onCheckedChange={(checked) => {
                          if (!project) return;
                          setProjectIds((current) =>
                            checked
                              ? [...current, project.id]
                              : current.filter((id) => id !== project.id),
                          );
                        }}
                      >
                        <span className="grid gap-1" data-loading={!project || undefined}>
                          <strong className={cn("text-[.86rem]", loadingPlaceholder(!project, "text", "long"))} data-placeholder={!project ? "text" : undefined} data-placeholder-width="long">{project?.title ?? "Project title"}</strong>
                          <small className={cn("text-[.72rem] text-ink-muted", loadingPlaceholder(!project, "label", "medium"))} data-placeholder={!project ? "label" : undefined} data-placeholder-width="medium">
                            {project ? `${project.tasks.completed} completed · ${project.tasks.due} due · ${project.tasks.open} open` : "Completed · due · open"}
                          </small>
                        </span>
                      </CheckboxControl>
                    ))
                  : <WorkspaceEmpty>No active project membership is available for reporting.</WorkspaceEmpty>)}
              </fieldset>

              <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0" disabled={!editable}>
                <legend>Papers and datasets used as evidence</legend>
                {(!context || context.outputs.length
                  ? (context?.outputs ?? Array.from({ length: 2 }, () => undefined)).map((output, index) => (
                      <CheckboxControl
                        checked={output ? outputIds.includes(output.id) : false}
                        disabled={!context}
                        id={output ? `weekly-output-${output.id}` : `weekly-output-loading-${index}`}
                        key={output?.id ?? `weekly-output-loading-${index}`}
                        loading={!output}
                        onCheckedChange={(checked) => {
                          if (!output) return;
                          setOutputIds((current) =>
                            checked
                              ? [...current, output.id]
                              : current.filter((id) => id !== output.id),
                          );
                        }}
                      >
                        <span className="grid gap-1" data-loading={!output || undefined}>
                          <strong className={cn("text-[.86rem]", loadingPlaceholder(!output, "text", "long"))} data-placeholder={!output ? "text" : undefined} data-placeholder-width="long">{output?.title ?? "Research output title"}</strong>
                          <small className={cn("text-[.72rem] text-ink-muted", loadingPlaceholder(!output, "label", "short"))} data-placeholder={!output ? "label" : undefined} data-placeholder-width="short">{output ? output.type === "PAPER" ? "Paper" : "Dataset" : "Paper or dataset"}</small>
                        </span>
                      </CheckboxControl>
                    ))
                  : <WorkspaceEmpty>No authored or contributed paper or dataset is available yet.</WorkspaceEmpty>)}
              </fieldset>

              {editable || !context ? (
                <div className="flex flex-wrap justify-end gap-3 max-[640px]:grid max-[640px]:grid-cols-1">
                  <ButtonControl disabled={!context || Boolean(working)} type="submit" variant="secondary">
                    <Save aria-hidden="true" size={16} />
                    {working === "save" ? "Saving…" : "Save draft"}
                  </ButtonControl>
                  <ButtonControl
                    disabled={!context || Boolean(working)}
                    onClick={() => void submitReport()}
                    variant="primary"
                  >
                    <CheckCircle2 aria-hidden="true" size={16} />
                    {working === "submit" ? "Submitting…" : "Submit report"}
                  </ButtonControl>
                </div>
              ) : (
                <p className="m-0 text-[.8rem] text-ink-muted">This report is with a supervisor. It becomes editable if changes are requested.</p>
              )}
            </form>
        </WorkspacePanel>

        <WorkspacePanel
          description="A durable record of submitted research activity and supervisor feedback."
          eyebrow="Reporting history"
          title="Previous weeks"
        >
          <div
            aria-busy={!history}
            className="grid"
            data-loading={!history || undefined}
          >
            {(history ?? Array.from({ length: 3 }, () => undefined)).map((report, index) => (
              <article className="grid gap-3 border-t border-line px-6 py-5 first:border-t-0 max-[640px]:p-5" key={report?.id ?? `report-loading-${index}`}>
                <span className="flex items-center justify-between gap-3">
                  <strong className={cn("text-[.86rem]", loadingPlaceholder(!report, "text", "medium"))} data-placeholder={!report ? "text" : undefined} data-placeholder-width="medium">{report ? reportWeek(report.weekStart) : "Reporting week"}</strong>
                  <Badge loading={!report} tone={report ? statusTone(report.status) : "neutral"}>{report ? reportStatusLabel(report.status) : "Draft"}</Badge>
                </span>
                <small className={cn("text-[.7rem] text-ink-muted", loadingPlaceholder(!report, "label", "long"))} data-placeholder={!report ? "label" : undefined} data-placeholder-width="long">
                  {report
                    ? `${report.projects.map(({ project }) => project.researchItem.title ?? "Untitled project").join(" · ")}${report.outputs.length ? ` · ${report.outputs.length} linked output${report.outputs.length === 1 ? "" : "s"}` : ""}`
                    : "Linked projects and research outputs"}
                </small>
                <p className={cn("m-0 line-clamp-3 text-[.8rem] leading-[1.5] text-ink-muted", loadingPlaceholder(!report, "text", "full"))} data-placeholder={!report ? "text" : undefined} data-placeholder-width="full">{report?.accomplishments ?? "Research activity and progress summary."}</p>
              </article>
            ))}
            {history?.length === 0 ? (
              <WorkspaceEmpty>Your first submitted report will appear here.</WorkspaceEmpty>
            ) : null}
          </div>
        </WorkspacePanel>
      </WorkspaceSplit>
    </WorkspaceSurface>
  );
}

export function statusTone(status: WeeklyReportStatus): BadgeTone {
  if (status === "REVIEWED") return "field";
  if (status === "CHANGES_REQUESTED") return "rust";
  if (status === "SUBMITTED") return "gold";
  return "neutral";
}
