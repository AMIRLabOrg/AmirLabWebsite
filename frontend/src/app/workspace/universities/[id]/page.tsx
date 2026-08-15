import { UniversityEditor } from "@/components/universities-admin";
import { WorkspacePageShell } from "@/components/workspace-page-shell";

export default async function UniversityPage({ params }: { params: Promise<{ id: string }> }) {
  return <WorkspacePageShell><UniversityEditor id={(await params).id} /></WorkspacePageShell>;
}
