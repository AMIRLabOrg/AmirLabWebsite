"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowRight, MoveUpRight } from "lucide-react";
import { PersonPortrait } from "@/components/person-portrait";
import { MotionScene } from "@/components/motion-scene";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import type { Person } from "@/lib/types";

type PeopleGroup =
  | "founder"
  | "advisor"
  | "lead"
  | "senior"
  | "researcher"
  | "assistant"
  | "intern"
  | "alumni"
  | "other";

const PEOPLE_SECTION_PREVIEW_LIMIT = 6;
const GROUPS: Array<{ key: PeopleGroup; title: string }> = [
  { key: "advisor", title: "Advisors" },
  { key: "lead", title: "Lead Researchers" },
  { key: "senior", title: "Senior Researchers" },
  { key: "researcher", title: "Researchers" },
  { key: "assistant", title: "Research Assistants" },
  { key: "intern", title: "Research Interns" },
  { key: "other", title: "Members" },
];

function peopleGroup(person: Person): PeopleGroup {
  const role = person.roleTitle?.toLowerCase() ?? "";
  if (role.includes("founder") || role.includes("research director"))
    return "founder";
  if (person.isAlumni) return "alumni";
  if (person.rank === "ADVISOR" || role.includes("advisor")) return "advisor";
  if (person.rank === "LEAD_RESEARCHER") return "lead";
  if (person.rank === "SENIOR_RESEARCHER") return "senior";
  if (person.rank === "RESEARCHER") return "researcher";
  if (person.rank === "RESEARCH_ASSISTANT") return "assistant";
  if (person.rank === "RESEARCH_INTERN") return "intern";
  return "other";
}

function personRole(person: Person): string {
  return (
    person.roleTitle ?? person.rank?.replaceAll("_", " ") ?? "AmirLab member"
  );
}

export function PeopleDirectory({
  people = [],
  loading = false,
}: {
  people?: Person[];
  loading?: boolean;
}) {
  const grouped = Map.groupBy(people, peopleGroup);
  const founder = grouped.get("founder")?.[0];
  const visibleGroups = GROUPS.flatMap((group) => {
    const members = grouped.get(group.key) ?? [];
    return members.length ? [{ ...group, members }] : [];
  });
  const alumni = grouped.get("alumni") ?? [];
  const loadingGroups = GROUPS.slice(0, 3).map((group) => ({
    ...group,
    members: [] as Person[],
  }));
  const groups = loading ? loadingGroups : visibleGroups;

  return (
    <div
      aria-busy={loading || undefined}
      className="mx-auto w-full max-w-[1280px] px-8 max-[640px]:px-4 grid gap-[3.6rem] pb-20 pt-[2.1rem] max-[720px]:gap-[2.6rem] max-[720px]:pt-[1.4rem]"
      data-loading={loading || undefined}
    >
      {founder || loading ? (
        <Founder loading={loading} person={founder} />
      ) : null}

      <section
        className="grid min-h-[220px] grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)] items-stretch border-y border-line-strong max-[1000px]:grid-cols-1 max-[720px]:min-h-0"
        aria-label="About the research team"
      >
        <div className="grid content-center py-[1.7rem] pr-8 max-[720px]:pr-0">
          <p className="m-0 mb-4 font-[var(--font-sans)] text-[.75rem] font-extrabold uppercase tracking-[.12em] text-brand">
            Research team
          </p>
          <h2 className="m-0 max-w-[720px] font-serif text-[clamp(1.7rem,3vw,2.7rem)] font-medium tracking-[-.035em]">
            Researchers from different fields and institutions.
          </h2>
          <p className="mt-3 max-w-[680px] text-[.8rem] leading-[1.65] text-ink-muted">
            Browse current members by research role. Individual profiles include
            available affiliations, research interests, publications, and
            project contributions.
          </p>
        </div>
        <div className="grid min-w-0 items-center overflow-hidden border-l border-line py-2 pl-[1.4rem] max-[1000px]:border-l-0 max-[1000px]:border-t max-[1000px]:pl-0">
          <MotionScene
            className="h-[210px] w-full opacity-[.74] max-[720px]:h-[170px]"
            variant="people"
          />
        </div>
      </section>

      {groups.map(({ key, title, members }) => (
        <PeopleSection
          key={key}
          loading={loading}
          members={members}
          title={title}
        />
      ))}

      {!loading && alumni.length ? (
        <PeopleSection members={alumni} title="Alumni" />
      ) : null}
    </div>
  );
}

function Founder({
  person,
  loading = false,
}: {
  person?: Person;
  loading?: boolean;
}) {
  const href = person ? `/people/${person.slug}` : "/people";
  return (
    <section
      className="border-t border-line-strong pt-[.8rem]"
      data-loading={loading || undefined}
    >
      <PeopleHeading title="Founder & Research Director" />
      <article className="grid grid-cols-[minmax(220px,320px)_minmax(0,1fr)] items-stretch gap-[clamp(1.8rem,4vw,4rem)] max-[720px]:grid-cols-[120px_minmax(0,1fr)] max-[480px]:grid-cols-1">
        <Link
          aria-disabled={loading || undefined}
          className="max-[480px]:max-w-[180px]"
          href={href}
          tabIndex={loading ? -1 : undefined}
        >
          <PersonPortrait
            loading={loading}
            person={person}
            priority
            variant="founder"
          />
        </Link>
        <div className="grid min-w-0 max-w-[760px] content-center">
          <p className="m-0 mb-4 font-[var(--font-sans)] text-[.75rem] font-extrabold uppercase tracking-[.12em] text-brand">
            Founder & Research Director
          </p>
          <h2
            className={cn(
              "mb-0 mt-[.15rem] font-serif text-[clamp(2rem,3.8vw,3.6rem)] font-medium leading-[.98] tracking-[-.045em] max-[720px]:text-[clamp(1.65rem,8vw,2.4rem)]",
              loadingPlaceholder(loading, "text", "long"),
            )}
            data-placeholder={loading ? "text" : undefined}
          >
            <Link
              aria-disabled={loading || undefined}
              href={href}
              tabIndex={loading ? -1 : undefined}
            >
              {person?.fullName ?? "Research director name"}
            </Link>
          </h2>
          {loading || person?.roleTitle ? (
            <p
              className={cn(
                "mt-[.55rem] text-[.85rem] leading-[1.5] text-ink-muted",
                loadingPlaceholder(loading, "text", "medium"),
              )}
              data-placeholder={loading ? "text" : undefined}
            >
              {loading ? "Role is loading" : person?.roleTitle}
            </p>
          ) : null}
          {loading || person?.headline ? (
            <p
              className={cn(
                "mt-[.55rem] font-mono text-[.64rem] leading-[1.5] text-ink-muted",
                loadingPlaceholder(loading, "text", "long"),
              )}
              data-placeholder={loading ? "text" : undefined}
            >
              {loading ? "Affiliation is loading" : person?.headline}
            </p>
          ) : null}
          {loading || person?.biography ? (
            <p
              className={cn(
                "mt-4 line-clamp-4 max-w-[700px] text-[.82rem] leading-[1.65] text-ink-muted max-[720px]:hidden",
                loadingPlaceholder(loading, "text", "full"),
              )}
              data-placeholder={loading ? "text" : undefined}
            >
              {loading ? "Biography is loading" : person?.biography}
            </p>
          ) : null}
          <Link
            className="mt-4 inline-flex w-fit items-center gap-[.45rem] text-[.78rem] font-bold text-brand"
            href={href}
            tabIndex={loading ? -1 : undefined}
          >
            View full profile <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </article>
    </section>
  );
}

function PeopleHeading({
  title,
  count,
  loading = false,
}: {
  title: string;
  count?: number;
  loading?: boolean;
}) {
  return (
    <header className="mb-[1.15rem] flex items-baseline justify-between gap-[.8rem]">
      <h2 className="font-serif text-[clamp(1.55rem,2.3vw,2.25rem)] font-medium tracking-[-.025em]">
        {title}
      </h2>
      {count !== undefined || loading ? (
        <span
          className={cn(
            "font-mono text-[.58rem] uppercase tracking-[.07em] text-ink-faint",
            loadingPlaceholder(loading, "value", "short"),
          )}
          data-placeholder={loading ? "value" : undefined}
        >
          {loading ? "—" : `${count} ${count === 1 ? "member" : "members"}`}
        </span>
      ) : null}
    </header>
  );
}

function PeopleSection({
  members,
  title,
  loading = false,
}: {
  members: Person[];
  title: string;
  loading?: boolean;
}) {
  return (
    <section
      className="border-t border-line-strong pt-[.8rem]"
      data-loading={loading || undefined}
    >
      <PeopleHeading count={members.length} loading={loading} title={title} />
      <MemberCollection loading={loading} members={members} />
    </section>
  );
}

function MemberCollection({
  members,
  loading = false,
}: {
  members: Person[];
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = !loading && members.length > PEOPLE_SECTION_PREVIEW_LIMIT;
  const visibleMembers = loading
    ? Array.from({ length: PEOPLE_SECTION_PREVIEW_LIMIT }, () => undefined)
    : expanded
      ? members
      : members.slice(0, PEOPLE_SECTION_PREVIEW_LIMIT);

  return (
    <>
      <div className="grid grid-cols-2 border-t border-line max-[720px]:grid-cols-1">
        {visibleMembers.map((person, index) => (
          <Member
            key={person?.id ?? `loading-${index}`}
            loading={loading}
            person={person}
            position={index}
          />
        ))}
      </div>
      {hasMore ? (
        <button
          aria-expanded={expanded}
          className="mt-[.9rem] inline-flex cursor-pointer items-center gap-[.35rem] border-0 border-b border-brand bg-transparent px-0 py-1 text-[.68rem] font-semibold text-brand"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? "Show less" : `See all ${members.length}`}
          <ArrowDown aria-hidden="true" size={15} />
        </button>
      ) : null}
    </>
  );
}

function Member({
  position,
  person,
  loading = false,
}: {
  position: number;
  person?: Person;
  loading?: boolean;
}) {
  const href = person ? `/people/${person.slug}` : "/people";
  const odd = position % 2 === 0;
  return (
    <Link
      aria-disabled={loading || undefined}
      className={cn(
        "group grid min-w-0 grid-cols-[66px_minmax(0,1fr)_auto] items-center gap-[.85rem] border-b border-line py-[.82rem] pr-[.9rem] text-inherit no-underline hover:bg-[color-mix(in_srgb,var(--brand-faint)_55%,transparent)] max-[480px]:grid-cols-[56px_minmax(0,1fr)_auto]",
        odd
          ? "border-r border-line pr-[1.4rem] max-[720px]:border-r-0 max-[720px]:pr-[.4rem]"
          : "pl-[1.4rem] max-[720px]:pl-0",
      )}
      href={href}
      tabIndex={loading ? -1 : undefined}
    >
      <PersonPortrait loading={loading} person={person} />
      <div className="min-w-0">
        <h3
          className={cn(
            "mb-1 mt-[.08rem] font-serif text-[1.12rem] font-medium leading-[1.2]",
            loadingPlaceholder(loading, "text", "medium"),
          )}
          data-placeholder={loading ? "text" : undefined}
        >
          {person?.fullName ?? "Research member"}
        </h3>
        <p
          className={cn(
            "m-0 block overflow-hidden text-ellipsis whitespace-nowrap text-[.7rem] leading-[1.4] text-ink-muted",
            loadingPlaceholder(loading, "text", "short"),
          )}
          data-placeholder={loading ? "text" : undefined}
        >
          {person ? personRole(person) : "Research role"}
        </p>
        {loading ||
        (person?.headline && person.headline !== person.roleTitle) ? (
          <small
            className={cn(
              "mt-[.18rem] block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[.56rem] leading-[1.4] text-ink-muted",
              loadingPlaceholder(loading, "text", "long"),
            )}
            data-placeholder={loading ? "text" : undefined}
          >
            {person?.headline ?? "Research area and affiliation"}
          </small>
        ) : null}
      </div>
      <MoveUpRight
        aria-hidden="true"
        className={cn(
          "text-ink-faint group-hover:text-brand",
          loading && "opacity-[.12]",
        )}
        data-loading-icon={loading || undefined}
        size={19}
      />
    </Link>
  );
}
