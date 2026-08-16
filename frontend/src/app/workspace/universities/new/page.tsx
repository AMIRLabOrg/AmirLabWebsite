import { UniversityEditor } from "@/components/universities-admin";
import { WorkspacePageShell } from "@/components/workspace-page-shell";

export default function NewUniversityPage() {
  return (
    <WorkspacePageShell>
      <UniversityEditor />
    </WorkspacePageShell>
  );
}
