import type { Metadata } from "next";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { WorkersMonitor } from "@/components/workers-monitor";

export const metadata: Metadata = { title: "Workers & tasks" };

export default function WorkersPage() {
  return (
    <WorkspacePageShell>
      <WorkersMonitor />
    </WorkspacePageShell>
  );
}
