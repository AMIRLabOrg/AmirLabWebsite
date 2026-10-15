"use client";

import { Fragment, type ReactNode } from "react";
import { BrandLockup } from "@/components/brand-mark";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
export function WorkspaceAuthCheck() {
  return (
    <div
      className="fixed inset-0 z-[100] grid min-h-svh place-items-center bg-canvas px-6"
      data-site="workspace"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative text-center">
        <div className="absolute bottom-full left-1/2 mb-8 -translate-x-1/2">
          <BrandLockup />
        </div>
        <div className="relative">
          <LoaderCircle
            aria-hidden="true"
            size={22}
            className="absolute top-1/2 right-full mr-3 -translate-y-1/2 animate-spin text-brand motion-reduce:animate-none"
          />
          <h1 className="m-0 font-serif text-[clamp(1.3rem,4vw,1.8rem)] font-medium leading-tight text-ink">
            Checking your session
          </h1>
          <p className="absolute top-full left-1/2 mt-3 w-[min(22rem,calc(100vw-3rem))] -translate-x-1/2 text-[.8rem] leading-relaxed text-ink-muted">
            Please wait while we verify your workspace access.
          </p>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceLoading() {
  return (
    <span className="sr-only" role="status" aria-busy="true">
      Checking workspace access
    </span>
  );
}

export function WorkspaceContent({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const ready = !loading && !!user;
  if (!ready) return <WorkspaceLoading />;
  return <Fragment key={user.id}>{children}</Fragment>;
}
