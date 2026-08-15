import type { Metadata } from "next";
import { PositionAdminEditor } from "@/components/position-admin";
import { WorkspacePageShell } from "@/components/workspace-page-shell";

export const metadata: Metadata = { title: "Create job post" };

export default function NewPositionPage() {
  return (
    <WorkspacePageShell>
      <PositionAdminEditor />
    </WorkspacePageShell>
  );
}
