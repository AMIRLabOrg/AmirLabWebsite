import type { Metadata } from "next";
import { Suspense } from "react";
import { AboutPageView } from "@/components/about-page-view";
import { getAboutContent } from "@/lib/api";

export const metadata: Metadata = {
  description: "Learn about AmirLab, its mission, research areas, and research team.",
  title: "About",
};

export default function AboutPage() {
  return <Suspense fallback={<AboutPageView loading />}><AboutContent /></Suspense>;
}

async function AboutContent() {
  const content = await getAboutContent();
  return <AboutPageView content={content} />;
}
