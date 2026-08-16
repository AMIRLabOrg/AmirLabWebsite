
import { IntroRegister, PageIntro } from "@/components/page-intro";
import { PublicationExplorer } from "@/components/publication-explorer";
import type { ResearchItem } from "@/lib/types";

export function PapersPageView({ papers, loading = false }: { papers?: ResearchItem[]; loading?: boolean }) {
  const list = papers ?? [];
  const years = list.map((item) => item.paper?.year).filter((value): value is number => typeof value === "number");
  const coverage = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : "Archive";

  return (
    <div>
      <PageIntro
        aside={
          <IntroRegister
            loading={loading}
            items={[
              { label: "Publications", value: loading ? "00" : list.length },
              { label: "Coverage", value: loading ? "0000-0000" : coverage },
              { label: "Links", value: "DOI / source" },
              { label: "Types", value: "Journal / conference" },
            ]}
            title="Publication overview"
          />
        }
        eyebrow="Publications"
        meta={<><span>Journal · Conference · Book chapter</span><span>DOI and source links where available</span></>}
        title="Publications"
      >
        Papers, conference proceedings, and book chapters published by AMIR Lab researchers and collaborators.
      </PageIntro>
      <PublicationExplorer staticLoading={loading} />
    </div>
  );
}
