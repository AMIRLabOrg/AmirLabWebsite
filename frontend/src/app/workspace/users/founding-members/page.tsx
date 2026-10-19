import type { Metadata } from "next";
import { FoundingMembersManagement } from "@/components/founding-members-management";
import { WorkspacePageShell } from "@/components/workspace-page-shell";

export const metadata: Metadata = { title: "Founding members" };

export default function FoundingMembersPage() {
  return (
    <WorkspacePageShell>
      <FoundingMembersManagement />
    </WorkspacePageShell>
  );
}
