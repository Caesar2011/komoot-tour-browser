import { useRef } from 'preact/hooks';
import type { JSX } from 'preact';

import type { Selection, ServerFilters, Tour, TreeNode } from '../../types.ts';
import { CONFIG } from '../../config.ts';

import { FilterPanel } from './FilterPanel/FilterPanel.tsx';
import { TourTree } from './TourTree/TourTree.tsx';
import styles from './Sidebar.module.css';

interface Props {
  tree: TreeNode | null;
  tourCount: number;
  selection: Selection | null;
  openPaths: Set<string>;
  filters: ServerFilters;
  onFilter: (query: string) => void;
  onFiltersChange: (filters: ServerFilters) => void;
  onSelectFolder: (path: string) => void;
  onSelectTour: (tour: Tour) => void;
  onTogglePath: (path: string) => void;
  onInlineRename?: (tour: Tour, newName: string) => Promise<void>;
}

export function Sidebar({
  tree,
  tourCount,
  selection,
  openPaths,
  filters,
  onFilter,
  onFiltersChange,
  onSelectFolder,
  onSelectTour,
  onTogglePath,
  onInlineRename,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => onFilter(value),
      CONFIG.FILTER_DEBOUNCE_MS,
    );
  };

  return (
    <aside class={styles.sidebar} aria-label="Tour navigation">
      <div class={styles.header}>
        Tours · <span>{tourCount}</span>
      </div>
      <div class={styles.filter}>
        <input
          class={styles.filterInput}
          type="search"
          placeholder="Filter tours…"
          aria-label="Filter tours by name"
          onInput={handleInput}
        />
      </div>
      <FilterPanel filters={filters} onChange={onFiltersChange} />
      <nav class={styles.tree} aria-label="Tour tree">
        {tree && (
          <TourTree
            node={tree}
            depth={0}
            isRoot
            selection={selection}
            openPaths={openPaths}
            onSelectFolder={onSelectFolder}
            onSelectTour={onSelectTour}
            onTogglePath={onTogglePath}
            onInlineRename={onInlineRename}
          />
        )}
      </nav>
    </aside>
  );
}
