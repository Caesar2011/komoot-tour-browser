import type { Selection, Tour, TreeNode } from '../../../types.ts';

import { sportIcon } from '../../../logic/utils.ts';
import { countTours } from '../../../logic/tree.ts';
import styles from './TourTree.module.css';

interface Props {
  node: TreeNode;
  depth: number;
  isRoot?: boolean;
  selection: Selection | null;
  openPaths: Set<string>;
  onSelectFolder: (path: string) => void;
  onSelectTour: (tour: Tour) => void;
  onTogglePath: (path: string) => void;
}

export function TourTree({
  node,
  depth,
  isRoot = false,
  selection,
  openPaths,
  onSelectFolder,
  onSelectTour,
  onTogglePath,
}: Props) {
  const childKeys = [...node.children.keys()].sort((a, b) => a.localeCompare(b));
  const hasKids = childKeys.length > 0 || node.tours.length > 0;
  const total = countTours(node);
  const isOpen = openPaths.has(node.path);
  const isFolderSelected =
    selection?.type === 'folder' && selection.path === node.path;

  const handleClick = () => {
    if (hasKids) onTogglePath(node.path);
    onSelectFolder(node.path);
  };

  const sorted = [...node.tours].sort((a, b) =>
    (b.date || '').localeCompare(a.date || ''),
  );

  return (
    <>
      <div
        class={`${styles.label} ${isFolderSelected ? styles.selected : ''}`}
        style={{ paddingLeft: `${depth * 16 + 10}px` }}
        onClick={handleClick}
      >
        <span class={`${styles.toggle} ${isOpen ? styles.open : ''}`}>
          {hasKids ? '▶' : ''}
        </span>
        <span class={styles.icon}>{isRoot ? '🏠' : '📁'}</span>
        <span class={styles.name}>{isRoot ? 'All Tours' : node.name}</span>
        <span class={styles.count}>{total}</span>
      </div>

      {isOpen && (
        <div class={styles.children}>
          {childKeys.map((key) => (
            <TourTree
              key={key}
              node={node.children.get(key)!}
              depth={depth + 1}
              selection={selection}
              openPaths={openPaths}
              onSelectFolder={onSelectFolder}
              onSelectTour={onSelectTour}
              onTogglePath={onTogglePath}
            />
          ))}

          {sorted.map((tour) => {
            const isTourSelected =
              selection?.type === 'tour' && selection.tourId === tour.id;
            return (
              <div
                key={tour.id}
                class={`${styles.label} ${isTourSelected ? styles.selected : ''}`}
                style={{ paddingLeft: `${(depth + 1) * 16 + 10}px` }}
                title={tour.name}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTour(tour);
                }}
              >
                <span class={styles.toggle} />
                <span class={styles.icon}>{sportIcon(tour.sport)}</span>
                <span class={styles.name}>
                  {tour._leafName || tour.name || 'Unnamed'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
