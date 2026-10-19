import { Suspense } from "react";
import { getPublicCacheConfig } from "@/lib/cache-config.mjs";
import { ResearchStats } from "@/components/research-stats";
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
  const [content, research, universities] = await Promise.all([
    getHomeContent(),
    getResearch("PAPER", 3),
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
      statistics={
        <Suspense
          fallback={
            <ResearchStats
              boundary={universities.length ? "none" : "bottom"}
              loading
            />
          }
        >
          <LiveStats boundary={universities.length ? "none" : "bottom"} />
        </Suspense>
      }
      universities={universities}
    />
  );
}

async function LiveStats({ boundary }: { boundary: "none" | "bottom" }) {
  return <ResearchStats boundary={boundary} stats={await getPublicStats()} />;
}

async function LiveOpportunities() {
  const positions = await getPositions();
  return <HomeOpportunitiesLink positions={positions} />;
}
