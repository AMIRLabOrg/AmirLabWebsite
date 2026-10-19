import { Suspense } from "react";
import { getPublicCacheConfig } from "@/lib/cache-config.mjs";
import { ResearchStats } from "@/components/research-stats";
import {
  HomePageView,
  HomeResearch,
  HomePartners,
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
  const content = await getHomeContent();
  return (
    <HomePageView
      content={content}
      opportunities={
        <Suspense fallback={<HomeOpportunitiesLink loading />}>
          <LiveOpportunities />
        </Suspense>
      }
      latestResearch={
        <Suspense fallback={<HomeResearch content={content} loading />}>
          <LatestResearch content={content} />
        </Suspense>
      }
      partners={
        <Suspense
          fallback={
            <HomePartners
              loading
              statistics={<ResearchStats loading boundary="none" />}
            />
          }
        >
          <AcademicPartners />
        </Suspense>
      }
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

async function LatestResearch({
  content,
}: {
  content: import("@/lib/types").HomeContent;
}) {
  return (
    <HomeResearch content={content} research={await getResearch("PAPER", 3)} />
  );
}

async function AcademicPartners() {
  const universities = await getUniversities();
  const boundary = universities.length ? "none" : "bottom";
  return (
    <HomePartners
      universities={universities}
      statistics={
        <Suspense fallback={<ResearchStats boundary={boundary} loading />}>
          <LiveStats boundary={boundary} />
        </Suspense>
      }
    />
  );
}
