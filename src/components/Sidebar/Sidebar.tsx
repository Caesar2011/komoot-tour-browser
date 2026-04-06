import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';

import type { SidebarItem } from '../../types.ts';
import { CONFIG } from '../../config.ts';
import { isOwnTour } from '../../logic/utils.ts';
import { useAppContext } from '../../contexts/useAppContext.ts';

import { FilterPanel } from './FilterPanel/FilterPanel.tsx';
import { TourTree } from './TourTree/TourTree.tsx';
import { SelectionStatusBar } from './SelectionStatusBar/SelectionStatusBar.tsx';
import styles from './Sidebar.module.css';

interface Props {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: Props) {
  const {
    userId,
    tours,
    sel,
    sidebarSel,
    dragDrop,
    customNameHook,
    handleActivateItem: rawHandleActivateItem,
    handleBulkDelete,
    handleBulkExport,
    handleOpenInKomoot,
    handleInlineRename,
    handleFolderRename,
    lastExportFormat,
    setLastExportFormat,
  } = useAppContext();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const pendingActivateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleActivateItem = useCallback(
    async (type: 'folder' | 'tour', path: string, tourId?: number) => {
      await rawHandleActivateItem(type, path, tourId);
      onNavigate?.();
    },
    [rawHandleActivateItem, onNavigate],
  );

  useEffect(() => {
    return () => {
      if (pendingActivateRef.current) clearTimeout(pendingActivateRef.current);
    };
  }, []);

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
      () => tours.handleFiltersChange({ ...tours.filters, nameQuery: value }),
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
            handleActivateItem('tour', item.path, item.tour.id);
          } else {
            handleActivateItem('folder', item.path);
          }
        }, CONFIG.CLICK_ACTIVATE_DELAY_MS);
      }
    },
    [
      renamingItem,
      dragDrop,
      handlePlainClick,
      handleCtrlClick,
      handleShiftClick,
      handleActivateItem,
    ],
  );

  const handleItemDoubleClick = useCallback(
    (_e: MouseEvent, item: SidebarItem) => {
      if (pendingActivateRef.current) {
        clearTimeout(pendingActivateRef.current);
        pendingActivateRef.current = null;
      }
      startRenameFor(item);
    },
    [startRenameFor],
  );

  const handleArrowClick = useCallback(
    (e: MouseEvent, item: SidebarItem) => {
      e.stopPropagation();
      if (item.type === 'folder') sel.handleTogglePath(item.path);
    },
    [sel],
  );

  const handleStartRename = useCallback(() => {
    if (!canRename()) return;
    startRename();
  }, [canRename, startRename]);

  const handleRefreshTours = useCallback(async () => {
    setRefreshing(true);
    try {
      await tours.refreshTours();
    } finally {
      setRefreshing(false);
    }
  }, [tours]);

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
            if (!sel.openPaths.has(item.path)) sel.openPath(item.path);
            else {
              activateFocused();
              handleActivateItem('folder', item.path);
            }
          } else if (item.tour) {
            activateFocused();
            handleActivateItem('tour', item.path, item.tour.id);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (focusIndex < 0 || focusIndex >= len) break;
          const item = flatItems[focusIndex];
          if (item.type === 'folder') {
            if (sel.openPaths.has(item.path)) {
              sel.closePath(item.path);
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
            handleActivateItem('tour', item.path, item.tour.id);
          else handleActivateItem('folder', item.path);
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
            handleBulkDelete();
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
    sel,
    renamingItem,
    selected,
    activateFocused,
    clearSelection,
    handleCtrlSpace,
    handleShiftArrow,
    handleSpace,
    handleActivateItem,
    handleBulkDelete,
    setFocusIndex,
    handleStartRename,
  ]);

  const renameEnabled = canRename();
  const isSpinning = refreshing || tours.loading;
  const isDirtyMappings = customNameHook.isDirty;

  return (
    <aside class={styles.sidebar} aria-label="Tour navigation">
      <div class={styles.header}>
        <span>
          Tours · <span>{tours.filteredTours.length}</span>
        </span>
        <div class={styles.headerActions}>
          <button
            class={`${styles.mappingBtn} ${isDirtyMappings ? styles.mappingDirty : ''}`}
            onClick={() =>
              window.dispatchEvent(new Event('open-mapping-dialog'))
            }
            title={
              isDirtyMappings
                ? 'Custom names have unsaved changes — export to keep them safe'
                : 'Import or export custom tour names'
            }
          >
            🏷️ Mapping{isDirtyMappings ? ' ⚠️' : ''}
          </button>
          <button
            class={styles.refreshBtn}
            onClick={handleRefreshTours}
            disabled={isSpinning}
            title="Force refresh tour list from server"
          >
            <span class={isSpinning ? styles.spinning : ''}>🔄</span>
          </button>
        </div>
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
        filters={tours.filters}
        onChange={tours.handleFiltersChange}
        allTours={tours.allTours}
      />
      <nav ref={navRef} class={styles.tree} aria-label="Tour tree" tabIndex={0}>
        {tours.tree && (
          <TourTree
            node={tours.tree}
            depth={0}
            isRoot
            activeItem={activeItem}
            selected={selected}
            openPaths={sel.openPaths}
            focusedIndex={focusIndex}
            flatItems={flatItems}
            renamingItem={renamingItem}
            dragOverPath={dragDrop.dragOverPath}
            isDragging={dragDrop.isDragging}
            userId={userId}
            customNames={customNameHook.customNames}
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
            onArrowClick={handleArrowClick}
            onInlineRename={handleInlineRename}
            onFolderRename={handleFolderRename}
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
          onSetExportFormat={setLastExportFormat}
          onExport={handleBulkExport}
          onDelete={handleBulkDelete}
          onRename={handleStartRename}
          onOpenInKomoot={handleOpenInKomoot}
        />
      )}
    </aside>
  );
}
