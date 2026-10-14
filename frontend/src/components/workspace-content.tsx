"use client";

import { Fragment, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  WorkspacePanel,
  workspaceShellClass,
} from "@/components/ui/workspace-surface";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export function WorkspaceLoading() {
  return (
    <section
      className={cn(workspaceShellClass, "grid gap-6 py-7")}
      role="status"
      aria-label="Checking workspace access"
      aria-busy="true"
    >
      <span className="sr-only">Checking workspace access</span>
      <div aria-hidden="true" className="grid gap-6">
        {[0, 1].map((index) => (
          <WorkspacePanel
            key={index}
            title={
              <span
                className={loadingPlaceholder(true, "text", "short")}
                data-placeholder="text"
              >
                Workspace
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-5 p-6 max-[640px]:grid-cols-1">
              {[0, 1, 2, 3].map((field) => (
                <div className="grid gap-2" key={field}>
                  <span
                    className={loadingPlaceholder(true, "label")}
                    data-placeholder="label"
                  >
                    Field
                  </span>
                  <div
                    className={loadingPlaceholder(true, "control")}
                    data-placeholder="control"
                  />
                </div>
              ))}
            </div>
          </WorkspacePanel>
        ))}
      </div>
    </section>
  );
}

export function WorkspaceContent({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const ready = !loading && !!user;
  if (!ready) return <WorkspaceLoading />;
  return <Fragment key={user.id}>{children}</Fragment>;
}
