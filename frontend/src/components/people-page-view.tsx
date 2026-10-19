import { PageIntro } from "@/components/page-intro";
import { PeopleDirectory } from "@/components/people-layout-showcase";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { peopleGroup } from "@/lib/people-groups";
import type { Person } from "@/lib/types";

export function PeoplePageView({
  people,
  loading = false,
}: {
  people?: Person[];
  loading?: boolean;
}) {
  const list = people ?? [];
  const groups = list.map((person) =>
    peopleGroup({ ...person, isFounder: false, isCofounder: false }),
  );
  const counts = [
    {
      count: groups.filter((group) =>
        ["advisor", "lead", "senior"].includes(group),
      ).length,
      singular: "Faculty",
      plural: "Faculty",
    },
    {
      count: groups.filter((group) => group === "researcher").length,
      singular: "Researcher",
      plural: "Researchers",
    },
    {
      count: groups.filter((group) => group === "assistant").length,
      singular: "Research assistant",
      plural: "Research assistants",
    },
    {
      count: groups.filter((group) => group === "intern").length,
      singular: "Intern",
      plural: "Interns",
    },
  ];

  return (
    <>
      <PageIntro
        scene="people"
        metaLoading={loading}
        eyebrow="People"
        meta={
          loading ? (
            <span
              aria-hidden="true"
              className={cn(loadingPlaceholder(true, "text", "long"), "block")}
              data-placeholder="text"
            />
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-sans text-[.82rem] leading-relaxed">
              {counts.map(({ count, plural, singular }, index) => (
                <span
                  className="inline-flex items-baseline gap-1.5"
                  key={plural}
                >
                  {index > 0 ? (
                    <span aria-hidden="true" className="mr-2 text-ink-faint">
                      ·
                    </span>
                  ) : null}
                  <strong className="font-semibold tabular-nums text-ink">
                    {count}
                  </strong>
                  {count === 1 ? singular : plural}
                </span>
              ))}
            </div>
          )
        }
        title="People behind the work"
      >
        Meet AMIR Lab researchers, research assistants, interns, advisors, and
        alumni.
      </PageIntro>
      <PeopleDirectory loading={loading} people={list} />
    </>
  );
}
