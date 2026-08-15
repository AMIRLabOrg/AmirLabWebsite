import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ProjectReviewQueue } from "@/components/project-review-queue";

export default function ProjectReviewsPage() {
  return (
    <WorkspacePageShell>
      <ProjectReviewQueue />
    </WorkspacePageShell>
  );
}
