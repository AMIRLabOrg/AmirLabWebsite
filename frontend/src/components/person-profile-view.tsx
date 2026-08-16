import Link from "next/link";
import { ArrowLeft, ExternalLink, Mail, Phone } from "lucide-react";
import { ExpandableBiography } from "@/components/expandable-biography";
import { PersonPortrait } from "@/components/person-portrait";
import { PersonResearchOutputs } from "@/components/person-research-outputs";
import { ProfileRecords } from "@/components/profile-records";
import { PublicShell } from "@/components/ui/public-shell";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import type { Person } from "@/lib/types";
import { normalizeProfileSection } from "@/lib/profile-content";

export function PersonProfileView({
  person,
  loading = false,
}: {
  person?: Person;
  loading?: boolean;
}) {
  const roles = (
    person?.roleTitle ??
    person?.rank?.replaceAll("_", " ") ??
    "AMIR Lab member"
  )
    .split(/\s*\|\|?\s*/)
    .map((role) => role.trim())
    .filter(Boolean);
  const visibleRoles = loading ? ["Research role", "Lab appointment"] : roles;
  const records = (person?.profileSections ?? []).map(normalizeProfileSection);

  return (
    <>
      <header
        aria-busy={loading || undefined}
        className="border-b border-line bg-surface"
        data-loading={loading || undefined}
      >
        <PublicShell className="grid grid-cols-[minmax(280px,420px)_minmax(0,1fr)] items-start gap-[clamp(3rem,7vw,7rem)] py-20 max-[960px]:max-w-[760px] max-[960px]:grid-cols-1 max-[640px]:gap-8 max-[640px]:py-12">
          <div className="grid gap-4">
            <Link
              className="inline-flex w-fit items-center gap-1.5 text-[.78rem] text-ink-muted hover:text-brand"
              href="/people"
            >
              <ArrowLeft aria-hidden="true" size={16} /> All people
            </Link>
            <PersonPortrait
              loading={loading}
              person={person}
              priority
              variant="profile"
            />
          </div>
          <div className="min-w-0">
            <div className="mb-6 flex flex-wrap gap-[.45rem]">
              {visibleRoles.map((role, index) => (
                <span
                  className={cn(
                    "bg-brand-soft px-[.58rem] py-[.38rem] font-mono text-[.65rem] font-bold tracking-[.06em] text-brand uppercase",
                    loading && loadingPlaceholder(true, "label"),
                  )}
                  data-placeholder={loading ? "label" : undefined}
                  key={`${role}-${index}`}
                >
                  {role}
                </span>
              ))}
            </div>
            <h1
              className={cn(
                "m-0 font-serif text-[clamp(3rem,6vw,6rem)] leading-[.96] font-normal tracking-[-.055em] max-[640px]:text-[clamp(2.5rem,13vw,4rem)]",
                loading && loadingPlaceholder(true, "text"),
              )}
              data-placeholder={loading ? "text" : undefined}
            >
              {person?.fullName ?? "Research member name"}
            </h1>
            {loading || person?.headline ? (
              <p
                className={cn(
                  "mt-[1.2rem] mb-0 text-base leading-[1.7] text-ink-muted",
                  loading && loadingPlaceholder(true, "text"),
                )}
                data-placeholder={loading ? "text" : undefined}
              >
                {loading ? "Profile headline is loading" : person?.headline}
              </p>
            ) : null}
            {loading || person?.biography ? (
              <ExpandableBiography
                loading={loading}
                text={person?.biography ?? undefined}
              />
            ) : null}
            <div className="mt-8 flex flex-wrap gap-x-[1.2rem] gap-y-[.6rem]">
              {loading ? (
                <>
                  <a
                    aria-disabled
                    className={cn(
                      "inline-flex items-center gap-[.4rem] break-words text-[.8rem] text-brand",
                      loadingPlaceholder(true, "text"),
                    )}
                    data-placeholder="text"
                    href="#"
                    tabIndex={-1}
                  >
                    <Mail
                      aria-hidden="true"
                      className="opacity-[.12]"
                      data-loading-icon="true"
                      size={16}
                    />{" "}
                    Loading email
                  </a>
                  <a
                    aria-disabled
                    className={cn(
                      "inline-flex items-center gap-[.4rem] break-words text-[.8rem] text-brand",
                      loadingPlaceholder(true, "text"),
                    )}
                    data-placeholder="text"
                    href="#"
                    tabIndex={-1}
                  >
                    <ExternalLink
                      aria-hidden="true"
                      className="opacity-[.12]"
                      data-loading-icon="true"
                      size={16}
                    />{" "}
                    Loading link
                  </a>
                </>
              ) : (
                <>
                  {person?.publicEmail ? (
                    <a
                      className="inline-flex items-center gap-[.4rem] break-words text-[.8rem] text-brand hover:text-brand-hover"
                      href={`mailto:${person.publicEmail}`}
                    >
                      <Mail aria-hidden="true" size={16} /> {person.publicEmail}
                    </a>
                  ) : null}
                  {person?.phone ? (
                    <a
                      className="inline-flex items-center gap-[.4rem] break-words text-[.8rem] text-brand hover:text-brand-hover"
                      href={`tel:${person.phone}`}
                    >
                      <Phone aria-hidden="true" size={16} /> {person.phone}
                    </a>
                  ) : null}
                  {person?.links?.map((link) => (
                    <a
                      className="inline-flex items-center gap-[.4rem] break-words text-[.8rem] text-brand hover:text-brand-hover"
                      href={link.url}
                      key={link.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink aria-hidden="true" size={16} /> {link.label}
                    </a>
                  ))}
                </>
              )}
            </div>
            {loading || person?.contactAddress ? (
              <p
                className={cn(
                  "mt-5 mb-0 max-w-[620px] font-mono text-[.72rem] leading-[1.5] text-ink-muted",
                  loading && loadingPlaceholder(true, "text"),
                )}
                data-placeholder={loading ? "text" : undefined}
              >
                {loading
                  ? "Contact address is loading"
                  : person?.contactAddress}
              </p>
            ) : null}
          </div>
        </PublicShell>
      </header>
      {loading || person?.contributions?.length ? (
        <PersonResearchOutputs
          contributions={person?.contributions ?? []}
          loading={loading}
        />
      ) : null}
      {loading || records.length ? (
        <ProfileRecords loading={loading} records={records} />
      ) : null}
    </>
  );
}
