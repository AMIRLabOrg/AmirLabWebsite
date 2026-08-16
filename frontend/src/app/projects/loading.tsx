import { ResearchListingView } from "@/components/research-listing";

export default function Loading() {
  return (
    <ResearchListingView
      description="Current and completed AMIR Lab research projects, including objectives, collaborators, milestones, updates, and linked outputs."
      eyebrow="Research projects"
      loading
      title="Projects"
      type="PROJECT"
    />
  );
}
