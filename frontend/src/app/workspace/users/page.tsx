import type { Metadata } from "next";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { UserManagement } from "@/components/user-management";

export const metadata: Metadata = { title: "Accounts" };

export default function UsersPage() {
  return (
    <WorkspacePageShell>
      <UserManagement />
    </WorkspacePageShell>
  );
}
