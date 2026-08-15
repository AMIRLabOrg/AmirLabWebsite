import { Plus } from "lucide-react";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { DepartmentIndex } from "@/components/department-admin";

import { ButtonLink } from "@/components/ui/button-control";
export default function DepartmentsAdminPage() {
  return (
    <WorkspacePageShell
      action={<ButtonLink href="/workspace/departments/new" variant="primary"><Plus aria-hidden="true" size={16} /> New department</ButtonLink>}
      description="Manage public research units and their independent Head, Lead, and member roles."
    >
      <DepartmentIndex />
    </WorkspacePageShell>
  );
}
