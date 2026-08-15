import type { Metadata } from "next";
import { PositionAdminList } from "@/components/position-admin";
import { WorkspacePageShell } from "@/components/workspace-page-shell";

export const metadata: Metadata = { title: "Job posts" };

export default function PositionsPage() {
  return (
    <WorkspacePageShell>
      <PositionAdminList />
    </WorkspacePageShell>
  );
}
