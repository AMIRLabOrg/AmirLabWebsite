import { Suspense } from "react";
import { IntroRegister, PageIntro } from "@/components/page-intro";
import { PublicationExplorer } from "@/components/publication-explorer";
import type { ResearchItem } from "@/lib/types";

export function PapersPageView({ papers, loading = false }: { papers?: ResearchItem[]; loading?: boolean }) {
  const list = papers ?? [];
  const years = list.map((item) => item.paper?.year).filter((value): value is number => typeof value === "number");
  const coverage = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "Archive";

  return (
    <div>
      <PageIntro
        aside={
          <IntroRegister
            loading={loading}
            items={[
              { label: "Published records", value: loading ? "00" : list.length },
              { label: "Coverage", value: loading ? "0000–0000" : coverage },
              { label: "Identity", value: "DOI / source URL" },
              { label: "Authorship", value: "Reviewed" },
            ]}
            title="Publication archive"
          />
        }
        eyebrow="Publications"
        index="PUB / 02"
        meta={<><span>Journal · Conference · Book chapter</span><span>Canonical source + reviewed authorship</span></>}
        title="Research output"
      >
        An indexed publication archive built around provenance, authorship, venue, and canonical source rather than decorative cards.
      </PageIntro>
      <Suspense fallback={<PublicationExplorer staticLoading />}>
        <PublicationExplorer staticLoading={loading} />
      </Suspense>
    </div>
  );
}
