import { IntroRegister, PageIntro } from "@/components/page-intro";
import { PeopleDirectory } from "@/components/people-layout-showcase";
import { loadingPlaceholder } from "@/lib/loading-style";
import type { Person } from "@/lib/types";

export function PeoplePageView({ people, loading = false }: { people?: Person[]; loading?: boolean }) {
  const list = people ?? [];
  const alumni = list.filter((person) => person.isAlumni).length;
  const active = list.length - alumni;
  const leads = list.filter((person) => ["ADVISOR", "LEAD_RESEARCHER", "SENIOR_RESEARCHER"].includes(person.rank ?? "")).length;

  return (
    <>
      <PageIntro
        aside={
          <IntroRegister
            loading={loading}
            items={[
              { label: "Active members", value: loading ? "00" : active },
              { label: "Senior / advisory", value: loading ? "00" : leads },
              { label: "Alumni", value: loading ? "00" : alumni },
              { label: "Profiles", value: loading ? "00" : list.length },
            ]}
            title="Team overview"
          />
        }
        eyebrow="People"
        meta={
          <>
            <span>Faculty · Researchers · Assistants · Interns</span>
            <span className={loadingPlaceholder(loading, "text", "medium")} data-placeholder={loading ? "text" : undefined}>{loading ? "00 profiles" : `${list.length} profiles`}</span>
          </>
        }
        title="People behind the work"
      >
        Meet AMIR Lab researchers, research assistants, interns, advisors, and alumni.
      </PageIntro>
      <PeopleDirectory loading={loading} people={list} />
    </>
  );
}
