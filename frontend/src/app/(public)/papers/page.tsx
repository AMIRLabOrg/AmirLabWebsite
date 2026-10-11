import type { Metadata } from "next";
import { PapersPageView } from "@/components/papers-page-view";
import { getResearch, getPublications } from "@/lib/api";

export const metadata: Metadata = { title: "Papers" };

export default async function PapersPage() {
  const [papers, publications] = await Promise.all([
    getResearch("PAPER"),
    getPublications(),
  ]);
  return <PapersPageView papers={papers} publications={publications} />;
}
