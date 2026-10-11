import { Suspense } from "react";
import { getPublicCacheConfig } from "@/lib/cache-config.mjs";
import {
  HomePageView,
  HomeOpportunitiesLink,
} from "@/components/home-page-view";
import {
  getHomeContent,
  getPositions,
  getPublicStats,
  getResearch,
  getUniversities,
} from "@/lib/api";

export default function Home() {
  return (
    <Suspense
      fallback={
        getPublicCacheConfig().enabled ? (
          <Suspense fallback={<HomePageView loading />}>
            <HomeContent />
          </Suspense>
        ) : (
          <HomePageView loading />
        )
      }
    >
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const [content, research, stats, universities] = await Promise.all([
    getHomeContent(),
    getResearch("PAPER"),
    getPublicStats(),
    getUniversities(),
  ]);
  return (
    <HomePageView
      content={content}
      opportunities={
        <Suspense fallback={<HomeOpportunitiesLink loading />}>
          <LiveOpportunities />
        </Suspense>
      }
      research={research}
      stats={stats}
      universities={universities}
    />
  );
}

async function LiveOpportunities() {
  const positions = await getPositions();
  return <HomeOpportunitiesLink positions={positions} />;
}
