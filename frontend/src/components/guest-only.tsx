"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function GuestOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { loading, user } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace("/workspace");
  }, [loading, router, user]);

  const checkingSession = loading || Boolean(user);
  return (
    <div
      aria-busy={checkingSession || undefined}
      className="grid min-h-svh w-full place-items-center py-[clamp(1.5rem,5vh,3.5rem)]"
      data-loading={checkingSession || undefined}
    >
      <div
        aria-hidden={Boolean(user) || undefined}
        className={`w-full ${checkingSession ? "pointer-events-none opacity-70" : ""}`}
        inert={checkingSession || undefined}
      >
        {children}
      </div>
    </div>
  );
}
