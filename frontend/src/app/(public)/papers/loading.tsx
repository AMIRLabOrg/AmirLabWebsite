import { Suspense } from "react";
import { PapersPageView } from "@/components/papers-page-view";
import { getPublicCacheConfig } from "@/lib/cache-config.mjs";
import PapersPage from "./page";

export default function Loading() {
  const loadingView = <PapersPageView loading />;
  if (!getPublicCacheConfig().enabled) return loadingView;
  return (
    <Suspense fallback={loadingView}>
      <PapersPage />
    </Suspense>
  );
}
