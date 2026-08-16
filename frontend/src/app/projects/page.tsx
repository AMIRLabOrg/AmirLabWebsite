import type { Metadata } from "next";
import { ResearchListing } from "@/components/research-listing";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <ResearchListing
      description="Current and completed AMIR Lab research projects, including objectives, collaborators, milestones, updates, and linked outputs."
      eyebrow="Research projects"
      title="Projects"
      type="PROJECT"
    />
  );
}
