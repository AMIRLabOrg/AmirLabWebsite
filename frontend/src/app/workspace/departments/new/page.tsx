import { DepartmentEditor } from "@/components/department-admin";
import { WorkspacePageShell } from "@/components/workspace-page-shell";

export default function NewDepartmentPage() {
  return <WorkspacePageShell><DepartmentEditor /></WorkspacePageShell>;
}
