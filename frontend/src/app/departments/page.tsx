import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageIntro } from "@/components/page-intro";
import { getDepartments } from "@/lib/api";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const departments = await getDepartments();
  const people = departments.reduce(
    (sum, department) =>
      sum + (department._count?.people ?? department.people.length),
    0,
  );
  return (
    <div className="pb-[clamp(4rem,7vw,6rem)]">
      <PageIntro
        eyebrow="Research units"
        meta={
          <>
            <span>
              {departments.length}{" "}
              {departments.length === 1 ? "department" : "departments"}
            </span>
            <span>
              {people} {people === 1 ? "member" : "members"}
            </span>
            <span>Research areas and teams</span>
          </>
        }
        title="Departments"
      >
        AMIR Lab departments group researchers by area while allowing projects
        and publications to involve members from multiple departments.
      </PageIntro>

      <section className="mx-auto grid w-full max-w-[var(--public-wide)] grid-cols-3 px-[var(--public-gutter)] pt-8 pb-10 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        {departments.map((department) => (
          <Link
            className="relative grid min-h-[185px] border-r border-b border-line px-[1.2rem] py-4 transition-colors duration-[140ms] hover:bg-[color-mix(in_srgb,var(--brand-faint)_65%,transparent)] nth-[3n]:border-r-0 max-[900px]:border-r max-[900px]:even:border-r-0 max-[800px]:min-h-[220px] max-[800px]:border-r-0 max-[800px]:p-5 max-[560px]:min-h-[150px]"
            href={`/departments/${department.slug}`}
            key={department.id}
          >
            {department.abbreviation ? (
              <p className="my-[.3rem] font-mono text-[.55rem] tracking-[.08em] text-brand uppercase">
                {department.abbreviation}
              </p>
            ) : null}
            <h2 className="mt-[1.3rem] mb-[.7rem] max-w-[500px] self-end font-serif text-[clamp(1.45rem,2.4vw,2.2rem)] leading-[1.05] font-medium tracking-[-.035em]">
              {department.name.replace(/^Department of\s+/i, "")}
            </h2>
            <div className="mt-[.3rem] flex items-center justify-between border-t border-dotted border-line pt-[.55rem]">
              <span className="font-mono text-[.55rem] tracking-[.08em] text-ink-faint uppercase">
                {department._count?.people ?? department.people.length} members
              </span>
              <ArrowUpRight aria-hidden="true" size={16} />
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
