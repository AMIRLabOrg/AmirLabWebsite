import { Suspense, type ReactNode } from "react";
import { SiteLayout } from "@/components/site-layout";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <SiteLayout variant="workspace">
      <Suspense fallback={null}>
        <WorkspaceShell>{children}</WorkspaceShell>
      </Suspense>
    </SiteLayout>
  );
}
