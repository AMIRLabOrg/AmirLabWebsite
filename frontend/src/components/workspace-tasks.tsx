"use client";

import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, FolderKanban } from "lucide-react";
import { StatePanel } from "@/components/state-panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { TabsControl } from "@/components/ui/tabs-control";
import {
  WorkspaceEmpty,
  WorkspaceHero,
  WorkspacePanel,
  WorkspaceSurface,
} from "@/components/ui/workspace-surface";
import { apiRequest } from "@/lib/client-api";

interface WorkspaceTask {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueAt: string | null;
  completedAt: string | null;
  projectId: string;
  project: { researchItem: { title: string | null } };
}

const filters = [
  { label: "Open", value: "OPEN" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Blocked", value: "BLOCKED" },
  { label: "Completed", value: "DONE" },
];

export function WorkspaceTasks() {
  const [tasks, setTasks] = useState<WorkspaceTask[]>();
  const [filter, setFilter] = useState("OPEN");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest<WorkspaceTask[]>("/workspace/tasks", { method: "GET" })
      .then((result) => {
        if (!active) return;
        setTasks(result);
        setError("");
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Tasks could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const visibleTasks = useMemo(
    () =>
      tasks?.filter((task) =>
        filter === "OPEN"
          ? task.status !== "DONE"
          : task.status === filter,
      ) ?? [],
    [filter, tasks],
  );
  const loadingTasks = !tasks && !error;
  const options = filters.map((option) => ({
    ...option,
    count:
      tasks?.filter((task) =>
        option.value === "OPEN"
          ? task.status !== "DONE"
          : task.status === option.value,
      ).length ?? 0,
  }));

  return (
    <WorkspaceSurface measure="reading">
      <WorkspaceHero
        description="One assignment list across every project. Tasks remain owned by their project, so planning, access and activity stay connected."
        eyebrow="My work · cross-project"
        meta={<span>{tasks?.length ?? "—"} assigned task{tasks?.length === 1 ? "" : "s"}</span>}
        title="My tasks"
      />

      {error && !tasks ? (
        <StatePanel
          action={{ label: "Try again", onClick: () => setReload((value) => value + 1) }}
          body={error}
          title="Could not load tasks"
          variant="error"
        />
      ) : null}

      <WorkspacePanel
        action={
          <TabsControl
            ariaLabel="Filter assigned tasks"
            onValueChange={setFilter}
            options={options}
            value={filter}
          />
        }
        description="Open a task's project to update its status, evidence or assignment."
        eyebrow="Assignment register"
        title={filters.find(({ value }) => value === filter)?.label ?? "Tasks"}
      >
        {loadingTasks || visibleTasks.length ? (
          <div className="grid" data-loading={loadingTasks || undefined}>
            {(loadingTasks ? Array.from({ length: 5 }, () => undefined) : visibleTasks).map((task, index) => {
              const href = task ? `/workspace/projects/${task.projectId}` : "#";
              return (
                <Link aria-disabled={loadingTasks || undefined} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 border-t border-line px-6 py-5 first:border-t-0 hover:bg-brand-faint motion-reduce:transition-none max-[760px]:grid-cols-[auto_minmax(0,1fr)_auto] max-[760px]:items-start max-[760px]:p-4" href={href} key={task?.id ?? `loading-task-${index}`} tabIndex={loadingTasks ? -1 : undefined}>
                <span className={`h-[9px] w-[9px] rounded-full ${task?.status === "IN_PROGRESS" ? "bg-brand" : task?.status === "BLOCKED" ? "bg-danger" : task?.status === "DONE" ? "bg-success" : "bg-line"}`} />
                <div className="grid min-w-0 gap-2">
                  <span className="flex flex-wrap gap-2">
                    <Badge dot loading={loadingTasks} tone={task ? taskTone(task.status) : "neutral"}>{task ? formatStatus(task.status) : "To do"}</Badge>
                    <Badge loading={loadingTasks} tone={task ? priorityTone(task.priority) : "neutral"}>{task ? formatStatus(task.priority) : "Normal"}</Badge>
                  </span>
                  <strong className={cn("text-[.92rem]", loadingPlaceholder(loadingTasks, "text"))} data-placeholder={loadingTasks ? "text" : undefined}>{task?.title ?? "Assigned task title"}</strong>
                  {loadingTasks || task?.description ? <p className={cn("m-0 text-[.78rem] leading-[1.45] text-ink-muted", loadingPlaceholder(loadingTasks, "text"))} data-placeholder={loadingTasks ? "text" : undefined}>{task?.description ?? "Task description and expected outcome"}</p> : null}
                  <small className={cn("flex items-center gap-2 text-[.7rem] text-ink-muted", loadingPlaceholder(loadingTasks, "text"))} data-placeholder={loadingTasks ? "text" : undefined}>
                    <FolderKanban aria-hidden="true" className={loadingTasks ? "opacity-[.12]" : undefined} data-loading-icon={loadingTasks || undefined} size={13} />
                    {task?.project.researchItem.title ?? "Research project"}
                  </small>
                </div>
                <div className={`flex items-center gap-2 whitespace-nowrap font-mono text-[.68rem] ${task && isOverdue(task) ? "text-danger" : "text-ink-muted"} max-[760px]:col-start-2 max-[520px]:whitespace-normal`}>
                  <CalendarDays aria-hidden="true" className={loadingTasks ? "opacity-[.12]" : undefined} data-loading-icon={loadingTasks || undefined} size={15} />
                  <span className={loadingPlaceholder(loadingTasks, "text")} data-placeholder={loadingTasks ? "text" : undefined}>{task ? task.dueAt ? formatDate(task.dueAt) : "No due date" : "00 Mon 0000"}</span>
                </div>
                <ArrowRight aria-hidden="true" className={cn("max-[760px]:col-start-3 max-[760px]:row-span-2 max-[760px]:row-start-1", loadingTasks && "opacity-[.12]")} data-loading-icon={loadingTasks || undefined} size={16} />
                </Link>
              );
            })}
          </div>
        ) : (
          <WorkspaceEmpty>No tasks match this view.</WorkspaceEmpty>
        )}
      </WorkspacePanel>
    </WorkspaceSurface>
  );
}

function taskTone(status: WorkspaceTask["status"]): BadgeTone {
  if (status === "BLOCKED") return "error";
  if (status === "IN_PROGRESS") return "info";
  return "neutral";
}

function priorityTone(priority: WorkspaceTask["priority"]): BadgeTone {
  if (priority === "URGENT") return "error";
  if (priority === "HIGH") return "warning";
  return "neutral";
}

function formatStatus(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function isOverdue(task: WorkspaceTask): boolean {
  return Boolean(task.dueAt && task.status !== "DONE" && new Date(task.dueAt) < new Date());
}

