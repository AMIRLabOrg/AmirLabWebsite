import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ProjectManager } from "@/components/project-workspace";

export default async function WorkspaceProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <WorkspacePageShell>
      <ProjectManager id={(await params).id} />
    </WorkspacePageShell>
  );
}
