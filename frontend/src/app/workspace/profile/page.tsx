import type { Metadata } from "next";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ProfileEditor } from "@/components/profile-editor";
import { ChangePasswordPanel } from "@/components/change-password-panel";
import { EmailChangePanel } from "@/components/email-change-panel";

export const metadata: Metadata = { title: "Edit profile" };

export default function ProfilePage() {
  return (
    <WorkspacePageShell>
      <ProfileEditor />
      <EmailChangePanel />
      <ChangePasswordPanel />
    </WorkspacePageShell>
  );
}
