import { PortraitImage } from "@/components/portrait-image";
import { ASSET_URL } from "@/lib/api-url";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
type PortraitPerson = { fullName: string; avatar?: { id: string } | null };

const variantClass = {
  directory: "aspect-square",
  small: "size-8 shrink-0 aspect-square",
  department: "aspect-[6/7]",
  founder: "aspect-[4/4.6] max-h-[360px] max-[720px]:max-h-[210px]",
  cofounder: "aspect-[4/4.6]",
  profile: "aspect-[4/5] w-full max-w-[300px] max-[960px]:mx-auto",
} as const;

export function PersonPortrait({
  person,
  priority = false,
  variant = "directory",
  loading = false,
  className,
}: {
  person?: PortraitPerson;
  priority?: boolean;
  variant?: keyof typeof variantClass;
  loading?: boolean;
  className?: string;
}) {
  const initials =
    (person?.fullName ?? "AM")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "AM";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-surface-subtle font-sans font-medium text-brand",
        variant === "small" ? "text-[.7rem]" : "text-[2rem]",
        variantClass[variant],
        loading && loadingPlaceholder(true, "portrait"),
        className,
      )}
      data-loading={loading || undefined}
      data-placeholder={loading ? "portrait" : undefined}
    >
      {!loading && person?.avatar ? (
        <PortraitImage
          key={person.avatar.id}
          initials={initials}
          priority={priority}
          sizes={
            variant === "small"
              ? "32px"
              : variant === "profile"
                ? "300px"
                : variant === "cofounder"
                  ? "(max-width: 480px) 80px, (max-width: 720px) 96px, 160px"
                  : variant === "founder"
                    ? "(max-width: 480px) 96px, (max-width: 720px) 120px, 240px"
                    : "(max-width: 640px) 44vw, (max-width: 1100px) 30vw, 220px"
          }
          src={`${ASSET_URL}/${person.avatar.id}`}
        />
      ) : (
        <span>{loading ? "AM" : initials}</span>
      )}
    </span>
  );
}
