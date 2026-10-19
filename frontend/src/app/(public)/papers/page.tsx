import type { Metadata } from "next";
import { PapersPageView } from "@/components/papers-page-view";
import { getPublications } from "@/lib/api";

export const metadata: Metadata = { title: "Papers" };

export default async function PapersPage() {
  const publications = await getPublications();
  return <PapersPageView publications={publications} />;
}
