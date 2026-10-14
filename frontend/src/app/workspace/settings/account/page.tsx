import { WorkspaceContent } from "@/components/workspace-content";
import type { Metadata } from "next";
import { AccountSettings } from "@/components/account-settings";
export const metadata: Metadata = { title: "Account & devices" };
export default function AccountPage() {
  return (
    <WorkspaceContent>
      <AccountSettings />
    </WorkspaceContent>
  );
}
