import { Suspense, type ReactNode } from "react";
import { SiteLayout } from "@/components/site-layout";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WorkspaceLoading } from "@/components/workspace-content";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <SiteLayout variant="workspace">
      <Suspense fallback={<WorkspaceLoading />}>
        <WorkspaceShell>{children}</WorkspaceShell>
      </Suspense>
    </SiteLayout>
  );
}
