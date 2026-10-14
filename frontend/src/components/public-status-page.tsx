import { PublicSection } from "@/components/ui/public-shell";
import { ButtonLink } from "@/components/ui/button-control";
import { loadingPlaceholder } from "@/lib/loading-style";
import { cn } from "@/lib/cn";

export function PublicStatusPage({
  label,
  title,
  description,
  href,
  action,
  loading = false,
}: {
  label: string;
  title: string;
  description: string;
  href: string;
  action: string;
  loading?: boolean;
}) {
  return (
    <PublicSection
      bay="plus"
      boundary="bottom"
      contentClassName="grid min-h-[60svh] content-center justify-items-start gap-6 py-20 max-[640px]:py-12"
    >
      <span className="font-mono text-xs tracking-[.12em] text-brand uppercase">
        {label}
      </span>
      <h1
        className={cn(
          "max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.08] tracking-tight",
          loadingPlaceholder(loading, "text"),
        )}
        data-placeholder={loading ? "text" : undefined}
      >
        {title}
      </h1>
      <p
        className={cn(
          "max-w-[520px] text-sm leading-relaxed text-ink-muted",
          loadingPlaceholder(loading, "text"),
        )}
        data-placeholder={loading ? "text" : undefined}
      >
        {description}
      </p>
      <ButtonLink href={href} variant="primary" loading={loading}>
        {action}
      </ButtonLink>
    </PublicSection>
  );
}
