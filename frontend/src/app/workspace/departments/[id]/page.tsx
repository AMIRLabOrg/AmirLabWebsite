import { DepartmentEditor } from "@/components/department-admin";
import { WorkspacePageShell } from "@/components/workspace-page-shell";

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <WorkspacePageShell>
      <DepartmentEditor id={(await params).id} />
    </WorkspacePageShell>
  );
}
