import type { Metadata } from "next";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { NotificationInbox } from "@/components/notification-inbox";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <WorkspacePageShell>
      <NotificationInbox />
    </WorkspacePageShell>
  );
}
