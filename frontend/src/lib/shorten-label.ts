export function shortenLabel(label: string, limit = 40): string {
  const characters = Array.from(label);
  return characters.length > limit
    ? `${characters
        .slice(0, limit - 1)
        .join("")
        .trimEnd()}…`
    : label;
}
