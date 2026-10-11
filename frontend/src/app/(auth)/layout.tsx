import { Suspense, type ReactNode } from "react";
import { SiteLayout } from "@/components/site-layout";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <SiteLayout variant="auth">
      <Suspense fallback={null}>{children}</Suspense>
    </SiteLayout>
  );
}
