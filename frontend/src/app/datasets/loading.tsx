import { ResearchListingView } from "@/components/research-listing";

export default function Loading() {
  return <ResearchListingView description="Datasets published or maintained by AMIR Lab researchers, with available version, license, modality, and access information." eyebrow="Research resources" loading title="Datasets" type="DATASET" />;
}
