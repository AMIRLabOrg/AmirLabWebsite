import { Plus } from "lucide-react";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ResearchConnectionsPanel } from "@/components/research-connections-panel";

import { ButtonLink } from "@/components/ui/button-control";
export default function SubmissionsPage() {
  return (
    <WorkspacePageShell
      description="Canonical URLs and contributor relationships"
      action={
        <ButtonLink href="/workspace/submissions/new" variant="primary">
          <Plus aria-hidden="true" size={16} /> New paper or dataset
        </ButtonLink>
      }
    >
      <ResearchConnectionsPanel />
    </WorkspacePageShell>
  );
}
