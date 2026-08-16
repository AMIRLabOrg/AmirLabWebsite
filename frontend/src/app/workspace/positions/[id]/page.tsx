import type { Metadata } from "next";
import { PositionAdminEditor } from "@/components/position-admin";
import { WorkspacePageShell } from "@/components/workspace-page-shell";

export const metadata: Metadata = { title: "Edit job post" };

export default async function EditPositionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <WorkspacePageShell>
      <PositionAdminEditor id={id} />
    </WorkspacePageShell>
  );
}
