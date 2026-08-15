import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ApplicationReviewQueue } from "@/components/application-review-queue";

export default function ApplicationsQueuePage() {
  return (
    <WorkspacePageShell>
      <ApplicationReviewQueue />
    </WorkspacePageShell>
  );
}
