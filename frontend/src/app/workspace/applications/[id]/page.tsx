import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ApplicationReviewDetail } from "@/components/application-review-detail";

export default async function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <WorkspacePageShell>
      <ApplicationReviewDetail id={id} />
    </WorkspacePageShell>
  );
}
