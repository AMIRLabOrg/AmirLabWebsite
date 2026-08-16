"use client";

import { useCallback, useState } from "react";
import type { ApiRequestError } from "./client-api";
import type { ReviewIssue } from "./review-issues";

export function useReviewIssues() {
  const [issues, setIssues] = useState<Record<string, ReviewIssue[]>>({});

  const capture = useCallback((error: ApiRequestError) => {
    if (!error.issues.length) return;
    setIssues((current) => {
      const next = { ...current };
      const grouped = new Map<string, ReviewIssue[]>();
      for (const issue of error.issues) {
        if (!issue.itemId) continue;
        grouped.set(issue.itemId, [
          ...(grouped.get(issue.itemId) ?? []),
          issue,
        ]);
      }
      for (const [itemId, itemIssues] of grouped) next[itemId] = itemIssues;
      return next;
    });
  }, []);

  const setOne = useCallback(
    (itemId: string, issue: Omit<ReviewIssue, "itemId">) => {
      setIssues((current) => ({
        ...current,
        [itemId]: [{ ...issue, itemId }],
      }));
    },
    [],
  );

  const clear = useCallback(() => setIssues({}), []);
  const clearOne = useCallback((itemId: string) => {
    setIssues((current) => {
      if (!(itemId in current)) return current;
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }, []);
  const forItem = useCallback(
    (itemId: string) => issues[itemId] ?? [],
    [issues],
  );

  return { capture, clear, clearOne, forItem, issues, setOne };
}
