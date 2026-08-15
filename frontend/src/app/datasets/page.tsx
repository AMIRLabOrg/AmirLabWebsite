import type { Metadata } from "next";
import { ResearchListing } from "@/components/research-listing";

export const metadata: Metadata = { title: "Datasets" };

export default function DatasetsPage() {
  return (
    <ResearchListing
      description="Verified datasets with version, license, modality, and links to the system responsible for access."
      eyebrow="Research resources"
      title="Datasets"
      type="DATASET"
    />
  );
}
