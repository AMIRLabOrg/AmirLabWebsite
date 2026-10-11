import {
  OpenPositionsPageView,
  OpenPositionsContent,
} from "@/components/open-positions-page-view";
import { getPublicCacheConfig } from "@/lib/cache-config.mjs";

export default function Loading() {
  if (!getPublicCacheConfig().enabled) return <OpenPositionsPageView loading />;
  // The introduction is static; only live positions need a loading state.
  return (
    <OpenPositionsPageView
      positionsContent={<OpenPositionsContent loading />}
    />
  );
}
