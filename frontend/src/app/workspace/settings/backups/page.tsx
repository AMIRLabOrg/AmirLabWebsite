import type { Metadata } from "next";
import { WorkspaceContent } from "@/components/workspace-content";
import { BackupSettings } from "@/components/backup-settings";
export const metadata: Metadata = { title: "Backup & restore" };
export default function BackupPage() {
  return (
    <WorkspaceContent>
      <BackupSettings />
    </WorkspaceContent>
  );
}
