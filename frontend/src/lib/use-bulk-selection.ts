"use client";

import { useEffect, useState } from "react";

export function useBulkSelection(visibleIds: readonly string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const visibleKey = visibleIds.join("\u0000");

  useEffect(() => {
    const visibleSet = new Set(visibleKey ? visibleKey.split("\u0000") : []);
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleSet.has(id)));
      if (next.size === current.size && [...next].every((id) => current.has(id))) {
        return current;
      }
      return next;
    });
  }, [visibleKey]);

  const selectedCount = selectedIds.size;
  const allSelected = visibleIds.length > 0 && selectedCount === visibleIds.length;
  const selectAllState: boolean | "indeterminate" = allSelected
    ? true
    : selectedCount > 0
      ? "indeterminate"
      : false;

  function toggle(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(visibleIds) : new Set());
  }

  function clear() {
    setSelectedIds(new Set());
  }

  return {
    allSelected,
    clear,
    isSelected: (id: string) => selectedIds.has(id),
    selectAllState,
    selectedCount,
    selectedIds,
    toggle,
    toggleAll,
  };
}
