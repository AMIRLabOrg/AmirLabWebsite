import { ApplicationForm } from "@/components/application-form";
import { ApplicationProcess } from "@/components/application-process";
import { IntroRegister, PageIntro } from "@/components/page-intro";
import { PositionList } from "@/components/position-list";
import type { Position } from "@/lib/types";

export function OpenPositionsPageView({ positions, loading = false }: { positions?: Position[]; loading?: boolean }) {
  const list = positions ?? [];
  return (
    <>
      <PageIntro
        aside={
          <IntroRegister
            loading={loading}
            items={[
              { label: "Open roles", value: loading ? "00" : list.length },
              { label: "Application", value: "No account needed" },
              { label: "Decision", value: "Human reviewed" },
              { label: "Status", value: loading ? "Checking" : list.length ? "Accepting" : "Closed" },
            ]}
            title="Opportunity register"
          />
        }
        eyebrow="Careers & opportunities"
        index="OPP / 06"
        meta={<><span>Research roles · Internships · Collaboration</span><span>Direct application workflow</span></>}
        title="Open opportunities"
      >
        Join a research group where responsibilities, review stages, and project work are visible. Applications remain human-reviewed.
      </PageIntro>
      <PositionList loading={loading} positions={list} />
      <section className="mx-auto w-full max-w-[1280px] px-8 max-[640px]:px-4 border-t border-line-strong pt-6" id="apply">
        <ApplicationForm positions={list} />
        <ApplicationProcess />
      </section>
    </>
  );
}
