"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function MemberOnly({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role !== "MEMBER") router.replace("/workspace");
  }, [loading, router, user]);

  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="mx-auto grid min-h-[260px] w-full max-w-[900px] place-items-center p-6 font-mono text-[.72rem] uppercase tracking-[.08em] text-ink-muted"
        role="status"
      >
        Checking member access…
      </div>
    );
  }
  if (user?.role !== "MEMBER") return null;
  return children;
}
