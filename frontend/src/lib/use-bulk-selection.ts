"use client";

import { useState } from "react";

interface SelectionState {
  scope: string;
  ids: Set<string>;
}

export function useBulkSelection(visibleIds: readonly string[]) {
  const visibleKey = visibleIds.join("\u0000");
  const [selection, setSelection] = useState<SelectionState>(() => ({
    ids: new Set(),
    scope: visibleKey,
  }));

  const selectedIds = selection.scope === visibleKey ? selection.ids : new Set<string>();
  const selectedCount = selectedIds.size;
  const allSelected = visibleIds.length > 0 && selectedCount === visibleIds.length;
  const selectAllState: boolean | "indeterminate" = allSelected
    ? true
    : selectedCount > 0
      ? "indeterminate"
      : false;

  function updateSelection(update: (current: Set<string>) => Set<string>) {
    setSelection((current) => {
      const scoped = current.scope === visibleKey ? current.ids : new Set<string>();
      return { ids: update(scoped), scope: visibleKey };
    });
  }

  function toggle(id: string, checked: boolean) {
    updateSelection((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelection({
      ids: checked ? new Set(visibleIds) : new Set(),
      scope: visibleKey,
    });
  }

  function clear() {
    setSelection({ ids: new Set(), scope: visibleKey });
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
