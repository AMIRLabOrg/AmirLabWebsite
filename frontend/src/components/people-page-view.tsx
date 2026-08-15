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
              { label: "Directory", value: "Verified profiles" },
            ]}
            title="People register"
          />
        }
        eyebrow="People"
        index="DIR / 01"
        meta={
          <>
            <span>Faculty · Researchers · Assistants · Interns</span>
            <span className={loadingPlaceholder(loading, "text", "medium")} data-placeholder={loading ? "text" : undefined}>{loading ? "00 indexed profiles" : `${list.length} indexed profiles`}</span>
          </>
        }
        title="People behind the work"
      >
        Researchers are indexed by role, research connection, and verified output, not placed in a decorative gallery.
      </PageIntro>
      <PeopleDirectory loading={loading} people={list} />
    </>
  );
}
