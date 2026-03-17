/**
 * Reusable data center filter toggle component.
 * Shows an "All" button plus individual data center buttons.
 * When "All" is selected, all data centers are shown.
 * Clicking an individual DC deselects "All" and shows only that DC.
 * Clicking "All" again resets to showing everything.
 * Multiple individual DCs can be selected at once.
 */

import { useMemo } from "react";

interface DataCenterFilterProps {
  /** All available data center names (will be sorted alphabetically) */
  dataCenters: string[];
  /** Currently selected data centers (empty = "All") */
  selected: Set<string>;
  /** Callback when selection changes */
  onChange: (selected: Set<string>) => void;
}

export default function DataCenterFilter({ dataCenters, selected, onChange }: DataCenterFilterProps) {
  const sortedDCs = useMemo(() => [...dataCenters].sort(), [dataCenters]);

  const isAllSelected = selected.size === 0;

  const handleAllClick = () => {
    onChange(new Set());
  };

  const handleDCClick = (dc: string) => {
    const next = new Set(selected);
    if (next.has(dc)) {
      next.delete(dc);
    } else {
      next.add(dc);
    }
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-xs text-muted-foreground font-medium mr-1">Filter:</span>
      <button
        onClick={handleAllClick}
        className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
          isAllSelected
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground border-border hover:bg-muted"
        }`}
      >
        All
      </button>
      {sortedDCs.map((dc) => {
        const isActive = selected.has(dc);
        return (
          <button
            key={dc}
            onClick={() => handleDCClick(dc)}
            className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {dc}
          </button>
        );
      })}
    </div>
  );
}
