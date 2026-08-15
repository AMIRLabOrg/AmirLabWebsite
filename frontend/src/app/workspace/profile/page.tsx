import type { Metadata } from "next";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ProfileEditor } from "@/components/profile-editor";

export const metadata: Metadata = { title: "Edit profile" };

export default function ProfilePage() {
  return (
    <WorkspacePageShell>
      <ProfileEditor />
    </WorkspacePageShell>
  );
}
