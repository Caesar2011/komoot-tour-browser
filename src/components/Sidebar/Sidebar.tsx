import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';

import type {
  ExportFormat,
  Filters,
  SidebarItem,
  Tour,
  TreeNode,
} from '../../types.ts';
import { CONFIG } from '../../config.ts';
import { Api } from '../../logic/api.ts';
import { isOwnTour } from '../../logic/utils.ts';
import type { useSidebarSelection } from '../../hooks/useSidebarSelection.ts';
import type { useDragDrop } from '../../hooks/useDragDrop.ts';

import { FilterPanel } from './FilterPanel/FilterPanel.tsx';
import { TourTree } from './TourTree/TourTree.tsx';
import { SelectionStatusBar } from './SelectionStatusBar/SelectionStatusBar.tsx';
import styles from './Sidebar.module.css';

interface Props {
  tree: TreeNode | null;
  tourCount: number;
  toursLoading: boolean;
  filters: Filters;
  allTours: Tour[];
  onFiltersChange: (filters: Filters) => void;
  onTogglePath: (path: string) => void;
  onOpenPath: (path: string) => void;
  onClosePath: (path: string) => void;
  openPaths: Set<string>;
  sidebarSel: ReturnType<typeof useSidebarSelection>;
  dragDrop: ReturnType<typeof useDragDrop>;
  onActivateItem: (
    type: 'folder' | 'tour',
    path: string,
    tourId?: number,
  ) => void;
  onBulkDelete: () => void;
  onBulkExport: (format: ExportFormat) => void;
  onOpenInKomoot: () => void;
  onInlineRename: (tour: Tour, newName: string) => Promise<void>;
  onFolderRename: (oldPath: string, newName: string) => Promise<void>;
  onRefreshTours: () => Promise<void>;
  lastExportFormat: ExportFormat;
  onSetExportFormat: (f: ExportFormat) => void;
}

export function Sidebar({
  tree,
  tourCount,
  toursLoading,
  filters,
  allTours,
  onFiltersChange,
  onTogglePath,
  onOpenPath,
  onClosePath,
  openPaths,
  sidebarSel,
  dragDrop,
  onActivateItem,
  onBulkDelete,
  onBulkExport,
  onOpenInKomoot,
  onInlineRename,
  onFolderRename,
  onRefreshTours,
  lastExportFormat,
  onSetExportFormat,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const pendingActivateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const userId = Api.userId;

  const {
    focusIndex,
    setFocusIndex,
    selected,
    activeItem,
    flatItems,
    selectionSummary,
    renamingItem,
    clearSelection,
    handlePlainClick,
    handleCtrlClick,
    handleShiftClick,
    activateFocused,
    handleSpace,
    handleCtrlSpace,
    handleShiftArrow,
    startRename,
    startRenameFor,
    finishRename,
    cancelRename,
  } = sidebarSel;

  const finishRenameAndRefocus = useCallback(
    (item: SidebarItem) => {
      finishRename(item);
      setTimeout(() => navRef.current?.focus(), 0);
    },
    [finishRename],
  );

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

  const canRename = useCallback((): boolean => {
    if (selected.size !== 1) return false;
    const [item] = selected.values();
    if (item.type === 'folder') return true;
    if (item.tourId == null) return false;
    const tour = flatItems.find(
      (fi) => fi.type === 'tour' && fi.tour?.id === item.tourId,
    )?.tour;
    if (!tour) return false;
    return isOwnTour(tour, userId);
  }, [selected, flatItems, userId]);

  const handleItemClick = useCallback(
    (e: MouseEvent, item: SidebarItem, index: number) => {
      if (renamingItem) return;
      if (dragDrop.shouldSuppressClick()) return;

      if (e.ctrlKey || e.metaKey) {
        handleCtrlClick(item, index);
      } else if (e.shiftKey) {
        handleShiftClick(item, index);
      } else {
        handlePlainClick(item, index);
        if (pendingActivateRef.current)
          clearTimeout(pendingActivateRef.current);
        pendingActivateRef.current = setTimeout(() => {
          pendingActivateRef.current = null;
          if (item.type === 'tour' && item.tour) {
            onActivateItem('tour', item.path, item.tour.id);
          } else {
            onActivateItem('folder', item.path);
          }
        }, 200);
      }
    },
    [
      renamingItem,
      dragDrop,
      handlePlainClick,
      handleCtrlClick,
      handleShiftClick,
      onActivateItem,
    ],
  );

  const handleItemDoubleClick = useCallback(
    (_e: MouseEvent, item: SidebarItem) => {
      if (pendingActivateRef.current) {
        clearTimeout(pendingActivateRef.current);
        pendingActivateRef.current = null;
      }
      if (item.type === 'tour' && item.tour) {
        if (!isOwnTour(item.tour, userId)) return;
      }
      startRenameFor(item);
    },
    [startRenameFor, userId],
  );

  const handleArrowClick = useCallback(
    (e: MouseEvent, item: SidebarItem) => {
      e.stopPropagation();
      if (item.type === 'folder') onTogglePath(item.path);
    },
    [onTogglePath],
  );

  const handleStartRename = useCallback(() => {
    if (!canRename()) return;
    startRename();
  }, [canRename, startRename]);

  const handleRefreshTours = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefreshTours();
    } finally {
      setRefreshing(false);
    }
  }, [onRefreshTours]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (renamingItem) return;
      const active = document.activeElement;
      const tagName = active?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'select' || tagName === 'textarea')
        return;
      if (!nav.contains(active) && active !== nav) return;

      const len = flatItems.length;
      if (!len) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (e.shiftKey) {
            handleShiftArrow(
              focusIndex < len - 1 ? focusIndex + 1 : focusIndex,
            );
          } else {
            setFocusIndex(focusIndex < len - 1 ? focusIndex + 1 : 0);
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (e.shiftKey) {
            handleShiftArrow(focusIndex > 0 ? focusIndex - 1 : focusIndex);
          } else {
            setFocusIndex(focusIndex > 0 ? focusIndex - 1 : len - 1);
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (focusIndex < 0 || focusIndex >= len) break;
          const item = flatItems[focusIndex];
          if (item.type === 'folder') {
            if (!openPaths.has(item.path)) onOpenPath(item.path);
            else {
              activateFocused();
              onActivateItem('folder', item.path);
            }
          } else if (item.tour) {
            activateFocused();
            onActivateItem('tour', item.path, item.tour.id);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (focusIndex < 0 || focusIndex >= len) break;
          const item = flatItems[focusIndex];
          if (item.type === 'folder') {
            if (openPaths.has(item.path)) {
              onClosePath(item.path);
            } else {
              const parentPath = item.path.includes('/')
                ? item.path.slice(0, item.path.lastIndexOf('/'))
                : '';
              const parentIdx = flatItems.findIndex(
                (fi) => fi.type === 'folder' && fi.path === parentPath,
              );
              if (parentIdx >= 0) setFocusIndex(parentIdx);
            }
          }
          break;
        }
        case ' ': {
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) handleCtrlSpace();
          else handleSpace();
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (focusIndex < 0 || focusIndex >= len) break;
          activateFocused();
          const item = flatItems[focusIndex];
          if (item.type === 'tour' && item.tour)
            onActivateItem('tour', item.path, item.tour.id);
          else onActivateItem('folder', item.path);
          break;
        }
        case 'F2': {
          e.preventDefault();
          handleStartRename();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          clearSelection();
          break;
        }
        case 'Delete':
        case 'Backspace': {
          if (selected.size > 0) {
            e.preventDefault();
            onBulkDelete();
          }
          break;
        }
        default:
          break;
      }
    };

    nav.addEventListener('keydown', handleKeyDown);
    return () => nav.removeEventListener('keydown', handleKeyDown);
  }, [
    flatItems,
    focusIndex,
    openPaths,
    renamingItem,
    selected,
    activateFocused,
    clearSelection,
    handleCtrlSpace,
    handleShiftArrow,
    handleSpace,
    onActivateItem,
    onBulkDelete,
    onClosePath,
    onOpenPath,
    setFocusIndex,
    handleStartRename,
  ]);

  const renameEnabled = canRename();
  const isSpinning = refreshing || toursLoading;

  return (
    <aside class={styles.sidebar} aria-label="Tour navigation">
      <div class={styles.header}>
        <span>
          Tours · <span>{tourCount}</span>
        </span>
        <button
          class={styles.refreshBtn}
          onClick={handleRefreshTours}
          disabled={isSpinning}
          title="Force refresh tour list from server"
        >
          <span class={isSpinning ? styles.spinning : ''}>🔄</span>
        </button>
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
      <FilterPanel
        filters={filters}
        onChange={onFiltersChange}
        allTours={allTours}
      />
      <nav ref={navRef} class={styles.tree} aria-label="Tour tree" tabIndex={0}>
        {tree && (
          <TourTree
            node={tree}
            depth={0}
            isRoot
            activeItem={activeItem}
            selected={selected}
            openPaths={openPaths}
            focusedIndex={focusIndex}
            flatItems={flatItems}
            renamingItem={renamingItem}
            dragOverPath={dragDrop.dragOverPath}
            isDragging={dragDrop.isDragging}
            userId={userId}
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
            onArrowClick={handleArrowClick}
            onInlineRename={onInlineRename}
            onFolderRename={onFolderRename}
            onCancelRename={cancelRename}
            onFinishRename={finishRenameAndRefocus}
            onDragStart={dragDrop.handleDragStart}
            onDragOver={dragDrop.handleDragOver}
            onDragLeave={dragDrop.handleDragLeave}
            onDrop={dragDrop.handleDrop}
            onDragEnd={dragDrop.handleDragEnd}
            onTouchStart={dragDrop.handleTouchStart}
            onTouchMove={dragDrop.handleTouchMove}
            onTouchEnd={dragDrop.handleTouchEnd}
          />
        )}
      </nav>
      {selectionSummary && (
        <SelectionStatusBar
          summary={selectionSummary}
          selectedCount={selected.size}
          canRename={renameEnabled}
          lastExportFormat={lastExportFormat}
          onSetExportFormat={onSetExportFormat}
          onExport={onBulkExport}
          onDelete={onBulkDelete}
          onRename={handleStartRename}
          onOpenInKomoot={onOpenInKomoot}
        />
      )}
    </aside>
  );
}
