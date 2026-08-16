import type { Metadata } from "next";
import { ResearchListing } from "@/components/research-listing";

export const metadata: Metadata = { title: "Datasets" };

export default function DatasetsPage() {
  return (
    <ResearchListing
      description="Datasets published or maintained by AMIR Lab researchers, with available version, license, modality, and access information."
      eyebrow="Research resources"
      title="Datasets"
      type="DATASET"
    />
  );
}
