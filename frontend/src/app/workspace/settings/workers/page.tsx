import type { Metadata } from "next";
import { WorkspaceContent } from "@/components/workspace-content";
import { WorkersMonitor } from "@/components/workers-monitor";

export const metadata: Metadata = { title: "Workers & tasks" };

export default function WorkersPage() {
  return (
    <WorkspaceContent>
      <WorkersMonitor />
    </WorkspaceContent>
  );
}
