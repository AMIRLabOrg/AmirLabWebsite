import { Suspense } from "react";
import type { Metadata } from "next";
import {
  OpenPositionsPageView,
  OpenPositionsContent,
} from "@/components/open-positions-page-view";
import { getPositions } from "@/lib/api";

export const metadata: Metadata = { title: "Open positions" };

export default function OpenPositionsPage() {
  return (
    <OpenPositionsPageView
      positionsContent={
        <Suspense fallback={<OpenPositionsContent loading />}>
          <LivePositions />
        </Suspense>
      }
    />
  );
}

async function LivePositions() {
  const positions = await getPositions();
  return <OpenPositionsContent positions={positions} />;
}
