import { Suspense } from "react";
import { PeoplePageView } from "@/components/people-page-view";
import { getPublicCacheConfig } from "@/lib/cache-config.mjs";
import PeoplePage from "./page";

export default function Loading() {
  const loadingView = <PeoplePageView loading />;
  if (!getPublicCacheConfig().enabled) return loadingView;
  // Warm data can render here, but a miss must not suspend the loading UI.
  return (
    <Suspense fallback={loadingView}>
      <PeoplePage />
    </Suspense>
  );
}
