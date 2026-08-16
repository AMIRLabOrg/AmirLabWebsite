import { ApplicationForm } from "@/components/application-form";
import { ApplicationProcess } from "@/components/application-process";
import { IntroRegister, PageIntro } from "@/components/page-intro";
import { PositionList } from "@/components/position-list";
import type { Position } from "@/lib/types";

export function OpenPositionsPageView({
  positions,
  loading = false,
}: {
  positions?: Position[];
  loading?: boolean;
}) {
  const list = positions ?? [];
  return (
    <>
      <PageIntro
        aside={
          <IntroRegister
            loading={loading}
            items={[
              { label: "Open roles", value: loading ? "00" : list.length },
              { label: "Account", value: "Not required" },
              { label: "Review", value: "Lab team" },
              {
                label: "Status",
                value: loading
                  ? "Checking"
                  : list.length
                    ? "Accepting"
                    : "Closed",
              },
            ]}
            title="Applications"
          />
        }
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
      <PositionList loading={loading} positions={list} />
      <section
        className="mx-auto grid w-full max-w-[1280px] grid-cols-[minmax(0,1fr)_minmax(280px,360px)] items-start gap-[clamp(1.5rem,3vw,3rem)] border-t border-line-strong px-8 pt-8 pb-16 max-[900px]:grid-cols-1 max-[640px]:px-4"
        id="apply"
      >
        <ApplicationForm positions={list} />
        <div className="border-l border-line pl-[clamp(1.25rem,2.2vw,2rem)] max-[900px]:border-l-0 max-[900px]:border-t max-[900px]:pt-8 max-[900px]:pl-0">
          <ApplicationProcess />
        </div>
      </section>
    </>
  );
}
