import { Suspense, type ReactNode } from "react";
import { SiteLayout } from "@/components/site-layout";
import { PublicStatusPage } from "@/components/public-status-page";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <SiteLayout>
      <Suspense
        fallback={
          <PublicStatusPage
            loading
            label="AmirLab"
            title="Loading page"
            description="Loading the lab’s latest information."
            href="/"
            action="Loading"
          />
        }
      >
        {children}
      </Suspense>
    </SiteLayout>
  );
}
