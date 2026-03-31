import type { Selection, SidebarItem, Tour, TreeNode } from '../../../types.ts';
import { sportIcon } from '../../../logic/utils.ts';
import { countTours } from '../../../logic/tree.ts';

import styles from './TourTree.module.css';

interface Props {
  node: TreeNode;
  depth: number;
  isRoot?: boolean;
  selection: Selection | null;
  openPaths: Set<string>;
  focusedItem: SidebarItem | null;
  onSelectFolder: (path: string) => void;
  onSelectTour: (tour: Tour) => void;
  onTogglePath: (path: string) => void;
  onContextMenu: (e: MouseEvent, item: SidebarItem) => void;
}

export function TourTree({
  node,
  depth,
  isRoot = false,
  selection,
  openPaths,
  focusedItem,
  onSelectFolder,
  onSelectTour,
  onTogglePath,
  onContextMenu,
}: Props) {
  const childKeys = [...node.children.keys()].sort((a, b) =>
    a.localeCompare(b),
  );
  const hasKids = childKeys.length > 0 || node.tours.length > 0;
  const total = countTours(node);
  const isOpen = openPaths.has(node.path);
  const isFolderSelected =
    selection?.type === 'folder' && selection.path === node.path;
  const isFocused =
    focusedItem?.type === 'folder' && focusedItem.path === node.path;

  const handleClick = () => {
    if (hasKids) onTogglePath(node.path);
    onSelectFolder(node.path);
  };

  const handleRightClick = (e: MouseEvent) => {
    onContextMenu(e, { type: 'folder', path: node.path, depth });
  };

  return (
    <ul role={isRoot ? 'tree' : 'group'} class={styles.treeList}>
      <li
        role="treeitem"
        aria-expanded={hasKids ? isOpen : undefined}
        aria-selected={isFolderSelected}
        aria-label={`${isRoot ? 'All Tours' : node.name}, ${total} tours`}
      >
        <div
          class={`${styles.label} ${isFolderSelected ? styles.selected : ''} ${isFocused ? styles.focused : ''}`}
          style={{ paddingLeft: `${depth * 16 + 10}px` }}
          data-sidebar-index
          onClick={handleClick}
          onContextMenu={handleRightClick}
        >
          <span class={`${styles.toggle} ${isOpen ? styles.open : ''}`}>
            {hasKids ? '▶' : ''}
          </span>
          <span class={styles.icon}>{isRoot ? '🏠' : '📁'}</span>
          <span class={styles.name}>{isRoot ? 'All Tours' : node.name}</span>
          <span class={styles.count}>{total}</span>
        </div>

        {isOpen && (
          <ul role="group">
            {childKeys.map((key) => (
              <TourTree
                key={key}
                node={node.children.get(key)!}
                depth={depth + 1}
                selection={selection}
                openPaths={openPaths}
                focusedItem={focusedItem}
                onSelectFolder={onSelectFolder}
                onSelectTour={onSelectTour}
                onTogglePath={onTogglePath}
                onContextMenu={onContextMenu}
              />
            ))}

            {node.tours.map((tour) => (
              <TourTreeItem
                key={tour.id}
                tour={tour}
                depth={depth}
                folderPath={node.path}
                selection={selection}
                focusedItem={focusedItem}
                onSelectTour={onSelectTour}
                onContextMenu={onContextMenu}
              />
            ))}
          </ul>
        )}
      </li>
    </ul>
  );
}

function statusEmoji(status?: string): string {
  switch (status) {
    case 'private':
      return '🔒';
    case 'friends':
      return '👥';
    case 'public':
      return '🌍';
    default:
      return '';
  }
}

interface ItemProps {
  tour: Tour;
  depth: number;
  folderPath: string;
  selection: Selection | null;
  focusedItem: SidebarItem | null;
  onSelectTour: (tour: Tour) => void;
  onContextMenu: (e: MouseEvent, item: SidebarItem) => void;
}

function TourTreeItem({
  tour,
  depth,
  folderPath,
  selection,
  focusedItem,
  onSelectTour,
  onContextMenu,
}: ItemProps) {
  const isTourSelected =
    selection?.type === 'tour' && selection.tourId === tour.id;
  const isRecorded = tour.type === 'tour_recorded';
  const isFocused =
    focusedItem?.type === 'tour' && focusedItem.tour?.id === tour.id;

  const handleRightClick = (e: MouseEvent) => {
    onContextMenu(e, { type: 'tour', path: folderPath, tour, depth: depth + 1 });
  };

  return (
    <li
      role="treeitem"
      aria-selected={isTourSelected}
      aria-label={`${tour._leafName || tour.name || 'Unnamed'}, ${tour.sport}, ${isRecorded ? 'recorded' : 'planned'}`}
    >
      <div
        class={`${styles.label} ${isTourSelected ? styles.selected : ''} ${isRecorded ? styles.recorded : ''} ${isFocused ? styles.focused : ''}`}
        style={{ paddingLeft: `${(depth + 1) * 16 + 10}px` }}
        title={tour.name}
        data-sidebar-index
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          onSelectTour(tour);
        }}
        onContextMenu={handleRightClick}
      >
        <span class={styles.toggle} />
        <span class={styles.icon}>{sportIcon(tour.sport)}</span>
        <span class={styles.name}>
          {tour._leafName || tour.name || 'Unnamed'}
        </span>
        <span class={styles.statusEmoji} title={tour.status ?? 'unknown'}>
          {statusEmoji(tour.status)}
        </span>
      </div>
    </li>
  );
}
