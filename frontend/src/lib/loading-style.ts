export type LoadingPlaceholderKind =
  "control" | "dark" | "label" | "portrait" | "text" | "value";
export type LoadingPlaceholderWidth = "full" | "long" | "medium" | "short";

const widthClass: Record<LoadingPlaceholderWidth, string> = {
  short: "w-[34%]",
  medium: "w-[68%]",
  long: "w-[88%]",
  full: "w-full",
};

export function loadingPlaceholder(
  loading: boolean,
  kind: LoadingPlaceholderKind = "text",
  width?: LoadingPlaceholderWidth,
) {
  if (!loading) return "";
  return [
    "relative overflow-hidden pointer-events-none select-none text-transparent caret-transparent decoration-transparent",
    "border-transparent! shadow-none! bg-surface-subtle",
    "after:absolute after:inset-0 after:pointer-events-none after:content-[''] after:bg-[color-mix(in_srgb,var(--shimmer-highlight)_50%,transparent)] after:opacity-0 after:animate-[placeholder-pulse_1.35s_ease-in-out_infinite] motion-reduce:after:animate-none",
    kind === "dark" && "bg-dark-surface-subtle",
    kind === "portrait" &&
      "bg-[linear-gradient(135deg,var(--surface-subtle),var(--brand-faint))]",
    kind === "control" && "min-h-[var(--control-height)]",
    kind === "label" && "min-h-[.72rem] min-w-[4.5rem] w-fit rounded-[2px]",
    kind === "text" && "min-h-[1em] rounded-[2px]",
    kind === "value" && "min-h-[1.05em] min-w-[2.4rem] rounded-[2px]",
    width && widthClass[width],
  ]
    .filter(Boolean)
    .join(" ");
}
