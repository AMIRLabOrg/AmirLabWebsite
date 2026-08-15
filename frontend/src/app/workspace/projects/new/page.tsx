import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ProjectCreationForm } from "@/components/project-creation-form";

export default function NewProjectPage() {
  return (
    <WorkspacePageShell>
      <ProjectCreationForm />
    </WorkspacePageShell>
  );
}
