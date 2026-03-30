import { useEffect, useRef, useState } from 'preact/hooks';

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
  onInlineRename?: (tour: Tour, newName: string) => Promise<void>;
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
  onInlineRename,
}: Props) {
  const childKeys = [...node.children.keys()].sort((a, b) =>
    a.localeCompare(b),
  );
  const hasKids = childKeys.length > 0 || node.tours.length > 0;
  const total = countTours(node);
  const isOpen = openPaths.has(node.path);
  const isFolderSelected =
    selection?.type === 'folder' && selection.path === node.path;

  const handleClick = () => {
    if (hasKids) onTogglePath(node.path);
    onSelectFolder(node.path);
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
          <ul role="group">
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
                onInlineRename={onInlineRename}
              />
            ))}

            {/* Preserve server-side sort order — no client re-sort */}
            {node.tours.map((tour) => (
              <TourTreeItem
                key={tour.id}
                tour={tour}
                depth={depth}
                selection={selection}
                onSelectTour={onSelectTour}
                onInlineRename={onInlineRename}
              />
            ))}
          </ul>
        )}
      </li>
    </ul>
  );
}

interface ItemProps {
  tour: Tour;
  depth: number;
  selection: Selection | null;
  onSelectTour: (tour: Tour) => void;
  onInlineRename?: (tour: Tour, newName: string) => Promise<void>;
}

function TourTreeItem({
  tour,
  depth,
  selection,
  onSelectTour,
  onInlineRename,
}: ItemProps) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef(false);

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const isTourSelected =
    selection?.type === 'tour' && selection.tourId === tour.id;
  const isRecorded = tour.type === 'tour_recorded';

  const enterEditMode = () => {
    if (!onInlineRename) return;
    setEditing(true);
    setError('');
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.value = tour.name || '';
        inputRef.current.focus();
        inputRef.current.select();
      }
    });
  };

  const commitRename = async () => {
    const newName = inputRef.current?.value.trim() ?? '';
    if (!newName || newName === tour.name) {
      setEditing(false);
      setError('');
      return;
    }
    try {
      setError('');
      await onInlineRename!(tour, newName);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    }
    if (e.key === 'Escape') {
      setEditing(false);
      setError('');
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (editingRef.current) commitRename();
    }, 150);
  };

  const handleDblClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    enterEditMode();
  };

  return (
    <li
      role="treeitem"
      aria-selected={isTourSelected}
      aria-label={`${tour._leafName || tour.name || 'Unnamed'}, ${tour.sport}, ${isRecorded ? 'recorded' : 'planned'}`}
    >
      <div
        class={`${styles.label} ${isTourSelected ? styles.selected : ''} ${isRecorded ? styles.recorded : ''}`}
        style={{ paddingLeft: `${(depth + 1) * 16 + 10}px` }}
        title={tour.name}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          if (!editing) onSelectTour(tour);
        }}
        onDblClick={handleDblClick}
      >
        <span class={styles.toggle} />
        <span class={styles.icon}>{sportIcon(tour.sport)}</span>
        {editing ? (
          <input
            ref={inputRef}
            class={styles.inlineRenameInput}
            type="text"
            aria-label="Rename tour"
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            onDblClick={(e: MouseEvent) => e.stopPropagation()}
          />
        ) : (
          <span class={styles.name}>
            {tour._leafName || tour.name || 'Unnamed'}
          </span>
        )}
        <span
          class={`${styles.statusDot} ${isRecorded ? styles.statusDotRecorded : styles.statusDotPlanned}`}
          title={isRecorded ? 'Recorded' : 'Planned'}
        />
      </div>
      {error && (
        <div
          class={styles.inlineError}
          style={{ paddingLeft: `${(depth + 1) * 16 + 28}px` }}
        >
          {error}
        </div>
      )}
    </li>
  );
}
