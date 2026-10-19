import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageIntro } from "@/components/page-intro";
import { StatePanel } from "@/components/state-panel";
import {
  FramedCollection,
  FramedRow,
  PublicSection,
  CollectionHeading,
} from "@/components/ui/public-shell";
import type { Department } from "@/lib/types";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export function DepartmentsPageView({
  departments = [],
  loading = false,
}: {
  departments?: Department[];
  loading?: boolean;
}) {
  const people = departments.reduce(
    (sum, department) =>
      sum + (department._count?.people ?? department.people.length),
    0,
  );
  return (
    <div className="pb-[clamp(4rem,7vw,6rem)]">
      <PageIntro
        scene="department"
        eyebrow="Research units"
        metaLoading={loading}
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

      <PublicSection
        contentClassName="pt-8 pb-10"
        data-loading={loading || undefined}
        aria-busy={loading || undefined}
      >
        <CollectionHeading
          eyebrow="Research units"
          title="Lab departments"
          count={`${departments.length} departments`}
          loading={loading}
        />
        {loading || departments.length ? (
          <FramedCollection className="grid">
            {(loading
              ? Array.from({ length: 6 }, () => undefined)
              : departments
            ).map((department, index) => {
              const memberCount =
                department?._count?.people ?? department?.people.length ?? 0;
              const row = (
                <div
                  aria-hidden={loading || undefined}
                  className={cn(
                    "group grid min-h-[112px] grid-cols-[130px_minmax(0,1fr)_auto] items-center gap-[clamp(1rem,3vw,3rem)] px-[var(--public-gutter)] py-5 transition-colors duration-[140ms] hover:bg-[color-mix(in_srgb,var(--brand-faint)_65%,transparent)] max-[640px]:min-h-0 max-[640px]:grid-cols-[minmax(0,1fr)_auto] max-[640px]:gap-x-4 max-[640px]:gap-y-2",
                    loading && "pointer-events-none",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-[.58rem] tracking-[.08em] text-brand uppercase max-[640px]:col-start-1 max-[640px]:row-start-1",
                      loadingPlaceholder(loading, "text", "short"),
                    )}
                    data-placeholder={loading ? "text" : undefined}
                  >
                    {department?.abbreviation ?? "Research unit"}
                  </span>
                  <h2
                    className={cn(
                      "m-0 max-w-[760px] font-sans text-[clamp(1.35rem,2.4vw,2rem)] leading-[1.08] font-medium tracking-[-.035em] max-[640px]:col-start-1 max-[640px]:row-start-2",
                      loadingPlaceholder(loading, "text", "long"),
                    )}
                    data-placeholder={loading ? "text" : undefined}
                  >
                    {department?.name.replace(/^Department of\s+/i, "") ??
                      "Department name"}
                  </h2>
                  <span className="flex items-center justify-end gap-8 max-[640px]:col-start-2 max-[640px]:row-span-2 max-[640px]:row-start-1 max-[640px]:gap-4">
                    <span
                      className={cn(
                        "font-mono text-[.58rem] tracking-[.06em] text-ink-faint uppercase",
                        loadingPlaceholder(loading, "text", "short"),
                      )}
                      data-placeholder={loading ? "text" : undefined}
                    >
                      {memberCount} {memberCount === 1 ? "member" : "members"}
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="text-ink-muted transition-colors duration-[140ms] group-hover:text-brand"
                      size={17}
                    />
                  </span>
                </div>
              );
              return (
                <FramedRow key={department?.id ?? `loading-${index}`}>
                  {department ? (
                    <Link href={`/departments/${department.slug}`}>{row}</Link>
                  ) : (
                    row
                  )}
                </FramedRow>
              );
            })}
          </FramedCollection>
        ) : (
          <StatePanel
            body="Published research departments will appear here when available."
            frame
            title="No departments published yet"
          />
        )}
      </PublicSection>
    </div>
  );
}
