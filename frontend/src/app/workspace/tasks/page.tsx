import type { Metadata } from "next";
import { WorkspaceTasks } from "@/components/workspace-tasks";
import { MemberOnly } from "@/components/member-only";

export const metadata: Metadata = { title: "My tasks" };

export default function WorkspaceTasksPage() {
  return <MemberOnly><WorkspaceTasks /></MemberOnly>;
}

