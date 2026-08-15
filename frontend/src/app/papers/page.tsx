import type { Metadata } from "next";
import { PapersPageView } from "@/components/papers-page-view";
import { getResearch } from "@/lib/api";

export const metadata: Metadata = { title: "Papers" };

export default async function PapersPage() {
  const papers = await getResearch("PAPER");
  return <PapersPageView papers={papers} />;
}
