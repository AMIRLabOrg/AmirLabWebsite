import { WorkspaceContent } from "@/components/workspace-content";
import type { Metadata } from "next";
import { WorkspaceTasks } from "@/components/workspace-tasks";
import { MemberOnly } from "@/components/member-only";

export const metadata: Metadata = { title: "My tasks" };

export default function WorkspaceTasksPage() {
  return (
    <WorkspaceContent>
      <MemberOnly>
        <WorkspaceTasks />
      </MemberOnly>
    </WorkspaceContent>
  );
}
