import { ResearchListingView } from "@/components/research-listing";

export default function Loading() {
  const loadingView = (
    <ResearchListingView
      description="Current and completed AMIR Lab research projects, including objectives, collaborators, milestones, updates, and linked outputs."
      eyebrow="Research projects"
      loading
      title="Projects"
      type="PROJECT"
    />
  );
  if (!getPublicCacheConfig().enabled) return loadingView;
  return (
    <Suspense fallback={loadingView}>
      <ProjectsPage />
    </Suspense>
  );
}
import { Suspense } from "react";
import { getPublicCacheConfig } from "@/lib/cache-config.mjs";
import ProjectsPage from "./page";
