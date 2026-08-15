import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ResearchReviewQueue } from "@/components/research-review-queue";

export default async function ResearchReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <WorkspacePageShell>
      <ResearchReviewQueue selectedId={id} />
    </WorkspacePageShell>
  );
}
