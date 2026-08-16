export type ReviewIssueTone =
  "error" | "warning" | "pending" | "success" | "info" | "neutral";

export interface ReviewIssue {
  itemId?: string;
  code?: string;
  field?: string;
  message: string;
  tone?: ReviewIssueTone;
}

export function issuesByItem(
  issues: ReviewIssue[],
): Map<string, ReviewIssue[]> {
  const grouped = new Map<string, ReviewIssue[]>();
  for (const issue of issues) {
    if (!issue.itemId) continue;
    grouped.set(issue.itemId, [...(grouped.get(issue.itemId) ?? []), issue]);
  }
  return grouped;
}

export function firstBlockingIssue(
  issues?: ReviewIssue[],
): ReviewIssue | undefined {
  return issues?.find(({ tone }) => tone === "error") ?? issues?.[0];
}
