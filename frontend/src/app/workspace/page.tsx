import { WorkspaceContent } from "@/components/workspace-content";
import type { Metadata } from "next";
import { WorkspaceDashboard } from "@/components/workspace-dashboard";

export const metadata: Metadata = { title: "Workspace" };

export default function WorkspacePage() {
  return (
    <WorkspaceContent>
      <WorkspaceDashboard />
    </WorkspaceContent>
  );
}
