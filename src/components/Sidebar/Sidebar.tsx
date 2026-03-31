import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';

import type { Filters, Selection, SidebarItem, Tour, TreeNode } from '../../types.ts';
import { CONFIG } from '../../config.ts';
import { flattenTree, collectTours, findNode } from '../../logic/tree.ts';
import { komootTourUrl, komootFolderUrl } from '../../logic/komoot.ts';
import {
  downloadTourGpx,
  downloadTourFit,
  downloadFolderGpx,
  downloadFolderFit,
} from '../../logic/export.ts';
import { ContextMenu } from '../ContextMenu/ContextMenu.tsx';
import type { ContextMenuAction } from '../ContextMenu/ContextMenu.tsx';

import { FilterPanel } from './FilterPanel/FilterPanel.tsx';
import { TourTree } from './TourTree/TourTree.tsx';
import styles from './Sidebar.module.css';

interface Props {
  tree: TreeNode | null;
  tourCount: number;
  selection: Selection | null;
  openPaths: Set<string>;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onSelectFolder: (path: string) => void;
  onSelectTour: (tour: Tour) => void;
  onTogglePath: (path: string) => void;
  onOpenPath: (path: string) => void;
  onClosePath: (path: string) => void;
  onRenameTour: (tour: Tour) => void;
  onRenameFolder: (path: string) => void;
  onDeleteTour: (tour: Tour) => void;
}

export function Sidebar({
  tree,
  tourCount,
  selection,
  openPaths,
  filters,
  onFiltersChange,
  onSelectFolder,
  onSelectTour,
  onTogglePath,
  onOpenPath,
  onClosePath,
  onRenameTour,
  onRenameFolder,
  onDeleteTour,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: SidebarItem;
  } | null>(null);

  const flatItems = useMemo(
    () => (tree ? flattenTree(tree, openPaths) : []),
    [tree, openPaths],
  );

  // Reset focus index when flat list changes to avoid stale references
  useEffect(() => {
    setFocusIndex((prev) => {
      if (prev < 0) return prev;
      if (prev >= flatItems.length) return flatItems.length - 1;
      return prev;
    });
  }, [flatItems]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusIndex < 0 || !navRef.current) return;
    const items = navRef.current.querySelectorAll('[data-sidebar-index]');
    const el = items[focusIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusIndex]);

  const handleInput = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => onFiltersChange({ ...filters, nameQuery: value }),
      CONFIG.FILTER_DEBOUNCE_MS,
    );
  };

  const activateItem = useCallback(
    (item: SidebarItem) => {
      if (item.type === 'folder') {
        onSelectFolder(item.path);
      } else if (item.tour) {
        onSelectTour(item.tour);
      }
    },
    [onSelectFolder, onSelectTour],
  );

  const isRootPath = (path: string) => path === '';

  const buildContextActions = useCallback(
    (item: SidebarItem): ContextMenuAction[] => {
      if (item.type === 'folder') {
        const node = tree ? findNode(tree, item.path) : null;
        const tours = node ? collectTours(node) : [];
        const folderName = item.path ? item.path.split('/').pop()! : 'All Tours';
        const actions: ContextMenuAction[] = [];

        // No rename for root folder
        if (!isRootPath(item.path)) {
          actions.push({
            label: 'Rename',
            icon: '✏️',
            shortcut: 'R',
            onClick: () => onRenameFolder(item.path),
          });
        }

        actions.push(
          {
            label: 'Open in Komoot',
            icon: '🔗',
            shortcut: 'O',
            onClick: () => window.open(komootFolderUrl(folderName, tours), '_blank'),
          },
          {
            label: 'Export GPX (zip)',
            icon: '📥',
            shortcut: 'G',
            onClick: () => downloadFolderGpx(tours, folderName),
          },
          {
            label: 'Export FIT (zip)',
            icon: '📥',
            shortcut: 'F',
            onClick: () => downloadFolderFit(tours, folderName),
          },
        );

        return actions;
      }
      const tour = item.tour!;
      return [
        {
          label: 'Rename',
          icon: '✏️',
          shortcut: 'R',
          onClick: () => onRenameTour(tour),
        },
        {
          label: 'Open in Komoot',
          icon: '🔗',
          shortcut: 'O',
          onClick: () => window.open(komootTourUrl(tour.id), '_blank'),
        },
        {
          label: 'Export GPX',
          icon: '📥',
          shortcut: 'G',
          onClick: () => downloadTourGpx(tour.id, tour.name),
        },
        {
          label: 'Export FIT',
          icon: '📥',
          shortcut: 'F',
          onClick: () => downloadTourFit(tour.id, tour.name),
        },
        {
          label: 'Delete',
          icon: '🗑️',
          shortcut: 'D',
          onClick: () => onDeleteTour(tour),
          danger: true,
        },
      ];
    },
    [tree, onRenameTour, onRenameFolder, onDeleteTour],
  );

  const handleContextMenu = useCallback(
    (e: MouseEvent, item: SidebarItem) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, item });
    },
    [],
  );

  // Keyboard navigation — only active when <nav> has focus
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (contextMenu) return;

      // Check the nav itself (or a child within it) has focus, but NOT an input/select
      const active = document.activeElement;
      const tagName = active?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') return;
      if (!nav.contains(active) && active !== nav) return;

      const len = flatItems.length;
      if (!len) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const next = focusIndex < len - 1 ? focusIndex + 1 : 0;
          setFocusIndex(next);
          activateItem(flatItems[next]);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prev = focusIndex > 0 ? focusIndex - 1 : len - 1;
          setFocusIndex(prev);
          activateItem(flatItems[prev]);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (focusIndex < 0 || focusIndex >= len) break;
          const item = flatItems[focusIndex];
          if (item.type === 'folder') {
            if (!openPaths.has(item.path)) {
              onOpenPath(item.path);
            }
            onSelectFolder(item.path);
          } else if (item.tour) {
            onSelectTour(item.tour);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (focusIndex < 0 || focusIndex >= len) break;
          const item = flatItems[focusIndex];
          if (item.type === 'folder' && openPaths.has(item.path)) {
            onClosePath(item.path);
          }
          break;
        }
        default: {
          if (focusIndex < 0 || focusIndex >= len) break;
          const item = flatItems[focusIndex];
          const key = e.key.toLowerCase();
          if (key === 'r') {
            e.preventDefault();
            if (item.type === 'folder' && !isRootPath(item.path)) onRenameFolder(item.path);
            else if (item.tour) onRenameTour(item.tour);
          } else if (key === 'o') {
            e.preventDefault();
            if (item.type === 'folder') {
              const node = tree ? findNode(tree, item.path) : null;
              const tours = node ? collectTours(node) : [];
              const folderName = item.path ? item.path.split('/').pop()! : 'All Tours';
              window.open(komootFolderUrl(folderName, tours), '_blank');
            } else if (item.tour) {
              window.open(komootTourUrl(item.tour.id), '_blank');
            }
          } else if (key === 'g') {
            e.preventDefault();
            if (item.type === 'folder') {
              const node = tree ? findNode(tree, item.path) : null;
              const tours = node ? collectTours(node) : [];
              const folderName = item.path ? item.path.split('/').pop()! : 'All Tours';
              downloadFolderGpx(tours, folderName);
            } else if (item.tour) {
              downloadTourGpx(item.tour.id, item.tour.name);
            }
          } else if (key === 'f') {
            e.preventDefault();
            if (item.type === 'folder') {
              const node = tree ? findNode(tree, item.path) : null;
              const tours = node ? collectTours(node) : [];
              const folderName = item.path ? item.path.split('/').pop()! : 'All Tours';
              downloadFolderFit(tours, folderName);
            } else if (item.tour) {
              downloadTourFit(item.tour.id, item.tour.name);
            }
          } else if (key === 'd') {
            e.preventDefault();
            if (item.type === 'tour' && item.tour) {
              onDeleteTour(item.tour);
            }
          }
          break;
        }
      }
    };

    nav.addEventListener('keydown', handleKeyDown);
    return () => nav.removeEventListener('keydown', handleKeyDown);
  }, [
    flatItems,
    focusIndex,
    openPaths,
    contextMenu,
    tree,
    activateItem,
    onSelectFolder,
    onSelectTour,
    onOpenPath,
    onClosePath,
    onRenameTour,
    onRenameFolder,
    onDeleteTour,
  ]);

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
          tabIndex={0}
          onInput={handleInput}
        />
      </div>
      <FilterPanel filters={filters} onChange={onFiltersChange} />
      <nav
        ref={navRef}
        class={styles.tree}
        aria-label="Tour tree"
        tabIndex={0}
      >
        {tree && (
          <TourTree
            node={tree}
            depth={0}
            isRoot
            selection={selection}
            openPaths={openPaths}
            focusedItem={focusIndex >= 0 && focusIndex < flatItems.length ? flatItems[focusIndex] : null}
            onSelectFolder={onSelectFolder}
            onSelectTour={onSelectTour}
            onTogglePath={onTogglePath}
            onContextMenu={handleContextMenu}
          />
        )}
      </nav>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={buildContextActions(contextMenu.item)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </aside>
  );
}
