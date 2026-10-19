import { PageIntro } from "@/components/page-intro";
import { PublicationExplorer } from "@/components/publication-explorer";
import type { PublicationResponse } from "@/lib/types";

export function PapersPageView({
  publications,
  loading = false,
}: {
  publications?: PublicationResponse;
  loading?: boolean;
}) {
  const years = publications?.facets.years.map(({ value }) => value) ?? [];
  const coverage = years.length
    ? `${Math.min(...years)}-${Math.max(...years)}`
    : "Archive";

  return (
    <div>
      <PageIntro
        scene="paper"
        metaLoading={loading}
        eyebrow="Publications"
        meta={
          <>
            <span>{publications?.total ?? 0} publications</span>
            <span>{coverage} coverage</span>
            <span>Journal · Conference · Book chapter</span>
            <span>DOI and source links</span>
          </>
        }
        title="Publications"
      >
        Papers, conference proceedings, and book chapters published by AMIR Lab
        researchers and collaborators.
      </PageIntro>
      <PublicationExplorer initialData={publications} staticLoading={loading} />
    </div>
  );
}
