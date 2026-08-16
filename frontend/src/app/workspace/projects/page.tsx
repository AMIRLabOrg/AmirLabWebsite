import { Plus } from "lucide-react";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ProjectIndex } from "@/components/project-workspace";

import { ButtonLink } from "@/components/ui/button-control";
export default function WorkspaceProjectsPage() {
  return (
    <WorkspacePageShell
      description="Manage milestones, activity, collaborators, linked outputs, and public progress."
      action={
        <ButtonLink href="/workspace/projects/new" variant="primary">
          New project <Plus size={16} />
        </ButtonLink>
      }
    >
      <ProjectIndex />
    </WorkspacePageShell>
  );
}
