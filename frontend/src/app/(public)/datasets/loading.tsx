import { ResearchListingView } from "@/components/research-listing";

export default function Loading() {
  const loadingView = (
    <ResearchListingView
      description="Datasets published or maintained by AMIR Lab researchers, with available version, license, modality, and access information."
      eyebrow="Research resources"
      loading
      title="Datasets"
      type="DATASET"
    />
  );
  if (!getPublicCacheConfig().enabled) return loadingView;
  return (
    <Suspense fallback={loadingView}>
      <DatasetsPage />
    </Suspense>
  );
}
import { Suspense } from "react";
import { getPublicCacheConfig } from "@/lib/cache-config.mjs";
import DatasetsPage from "./page";
