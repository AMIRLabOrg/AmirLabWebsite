import { ResearchLibrary } from "@/components/research-library";
import { WorkspacePageShell } from "@/components/workspace-page-shell";

export default function SubmissionsPage() {
  return (
    <WorkspacePageShell description="Source-synced papers and datasets linked by OpenAlex author ID">
      <ResearchLibrary />
    </WorkspacePageShell>
  );
}
