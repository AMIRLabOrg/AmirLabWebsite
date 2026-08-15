import { Suspense } from "react";
import { HomePageView } from "@/components/home-page-view";
import { getHomeContent, getPositions, getPublicStats, getResearch, getUniversities } from "@/lib/api";

export default function Home() {
  return <Suspense fallback={<HomePageView loading />}><HomeContent /></Suspense>;
}

async function HomeContent() {
  const [content, research, positions, stats, universities] = await Promise.all([
    getHomeContent(),
    getResearch("PAPER"),
    getPositions(),
    getPublicStats(),
    getUniversities(),
  ]);
  return <HomePageView content={content} positions={positions} research={research} stats={stats} universities={universities} />;
}
