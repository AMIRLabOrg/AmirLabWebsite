import type { ReactNode } from "react";
import { OpenPositionsContent } from "@/components/open-positions-content";
export { OpenPositionsContent } from "@/components/open-positions-content";
import { PageIntro } from "@/components/page-intro";
import type { Position } from "@/lib/types";

export function OpenPositionsPageView({
  positions,
  loading = false,
  positionsContent,
}: {
  positions?: Position[];
  loading?: boolean;
  positionsContent?: ReactNode;
}) {
  return (
    <>
      <PageIntro
        scene="position"
        loading={loading}
        eyebrow="Careers & opportunities"
        meta={
          <>
            <span>Research roles · Internships</span>
            <span>Apply with a CV</span>
          </>
        }
        title="Open opportunities"
      >
        Current AMIR Lab research roles and internships. Applications are
        reviewed by the lab team.
      </PageIntro>
      {positionsContent ?? (
        <OpenPositionsContent loading={loading} positions={positions} />
      )}
    </>
  );
}
