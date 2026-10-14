"use client";

import { useParams } from "next/navigation";
import { AdminOnly } from "@/components/admin-only";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ProfileEditor } from "@/components/profile-editor";

export default function EditAccountPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <WorkspacePageShell>
      <AdminOnly>
        <ProfileEditor userId={id} />
      </AdminOnly>
    </WorkspacePageShell>
  );
}
