import type { Metadata } from "next";
import { ResearchListing } from "@/components/research-listing";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <ResearchListing
      description="Active and completed research programs, their objectives, collaborators, and linked outputs."
      eyebrow="What we are building"
      title="Projects"
      type="PROJECT"
    />
  );
}
