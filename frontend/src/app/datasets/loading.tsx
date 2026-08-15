import { ResearchListingView } from "@/components/research-listing";

export default function Loading() {
  return <ResearchListingView description="Verified datasets with version, license, modality, and links to the system responsible for access." eyebrow="Research resources" loading title="Datasets" type="DATASET" />;
}
