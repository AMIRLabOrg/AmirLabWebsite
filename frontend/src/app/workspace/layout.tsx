import { Suspense, type ReactNode } from "react";
import { SiteLayout } from "@/components/site-layout";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WorkspaceAuthCheck } from "@/components/workspace-content";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <SiteLayout variant="workspace">
      <Suspense fallback={<WorkspaceAuthCheck />}>
        <WorkspaceShell>{children}</WorkspaceShell>
      </Suspense>
    </SiteLayout>
  );
}
