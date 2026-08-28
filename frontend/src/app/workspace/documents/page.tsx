import type { Metadata } from "next";
import { DocumentsWorkspace } from "@/components/documents-workspace";
import { WorkspacePageShell } from "@/components/workspace-page-shell";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <WorkspacePageShell>
      <DocumentsWorkspace />
    </WorkspacePageShell>
  );
}
