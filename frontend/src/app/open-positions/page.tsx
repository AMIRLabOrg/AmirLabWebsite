import type { Metadata } from "next";
import { OpenPositionsPageView } from "@/components/open-positions-page-view";
import { getPositions } from "@/lib/api";

export const metadata: Metadata = { title: "Open positions" };

export default async function OpenPositionsPage() {
  const positions = await getPositions();
  return <OpenPositionsPageView positions={positions} />;
}
