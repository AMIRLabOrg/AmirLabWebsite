import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ProfileReviewDetail } from "@/components/profile-review-detail";

export default async function ProfileReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <WorkspacePageShell>
      <ProfileReviewDetail id={id} />
    </WorkspacePageShell>
  );
}
