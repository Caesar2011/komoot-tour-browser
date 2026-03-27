import { useRef } from 'preact/hooks';

import type { Selection, Tour, TreeNode } from '../../types.ts';

import { CONFIG } from '../../config.ts';
import { TourTree } from './TourTree/TourTree.tsx';
import styles from './Sidebar.module.css';

interface Props {
  tree: TreeNode | null;
  tourCount: number;
  selection: Selection | null;
  openPaths: Set<string>;
  onFilter: (query: string) => void;
  onSelectFolder: (path: string) => void;
  onSelectTour: (tour: Tour) => void;
  onTogglePath: (path: string) => void;
}

export function Sidebar({
  tree,
  tourCount,
  selection,
  openPaths,
  onFilter,
  onSelectFolder,
  onSelectTour,
  onTogglePath,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onFilter(value), CONFIG.FILTER_DEBOUNCE_MS);
  };

  return (
    <aside class={styles.sidebar}>
      <div class={styles.header}>
        Tours · <span>{tourCount}</span>
      </div>
      <div class={styles.filter}>
        <input
          class={styles.filterInput}
          type="search"
          placeholder="Filter tours…"
          onInput={handleInput}
        />
      </div>
      <nav class={styles.tree}>
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
          />
        )}
      </nav>
    </aside>
  );
}
