import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';

import type {
  SelectionItem,
  SelectionItemKey,
  SidebarItem,
  TreeNode,
} from '../types.ts';
import { flattenTree } from '../logic/tree.ts';
import {
  itemKey,
  selectionItemFromSidebarItem,
  resolveEffectiveTours,
} from '../logic/selection.ts';
import { formatDist, formatDur } from '../logic/utils.ts';

export interface SidebarSelectionState {
  focusIndex: number;
  selected: Map<SelectionItemKey, SelectionItem>;
  activeItem: { type: 'folder' | 'tour'; path: string; tourId?: number } | null;
  shiftAnchor: number | null;
  flatItems: SidebarItem[];
  renamingItem: SidebarItem | null;
  selectionSummary: {
    count: number;
    distance: number;
    duration: number;
    label: string;
  } | null;
}

export function useSidebarSelection(
  tree: TreeNode | null,
  openPaths: Set<string>,
) {
  const [focusIndex, setFocusIndex] = useState(-1);
  const [selected, setSelected] = useState<
    Map<SelectionItemKey, SelectionItem>
  >(() => new Map());
  const [activeItem, setActiveItem] =
    useState<SidebarSelectionState['activeItem']>(null);
  const [shiftAnchor, setShiftAnchor] = useState<number | null>(null);
  const [renamingItem, setRenamingItem] = useState<SidebarItem | null>(null);

  const flatItems = useMemo(
    () => (tree ? flattenTree(tree, openPaths) : []),
    [tree, openPaths],
  );

  // Keep focus in range when list changes
  useEffect(() => {
    setFocusIndex((prev) => {
      if (prev < 0) return prev;
      if (prev >= flatItems.length) return Math.max(0, flatItems.length - 1);
      return prev;
    });
  }, [flatItems]);

  // Clear selection + focus when tree changes (filtering)
  const prevTreeRef = useRef(tree);
  useEffect(() => {
    if (prevTreeRef.current !== tree) {
      prevTreeRef.current = tree;
      setSelected(new Map());
      setShiftAnchor(null);
      setFocusIndex((prev) => {
        if (prev < 0 || prev >= flatItems.length) return -1;
        return prev;
      });
    }
  }, [tree, flatItems]);

  const effectiveTours = useMemo(
    () => resolveEffectiveTours(selected, tree),
    [selected, tree],
  );

  const selectionSummary = useMemo(() => {
    if (selected.size === 0) return null;
    const tours = effectiveTours;
    const count = tours.length;
    const distance = tours.reduce((s, t) => s + t.distance, 0);
    const duration = tours.reduce((s, t) => s + t.duration, 0);
    return {
      count,
      distance,
      duration,
      label: `${count} tour${count !== 1 ? 's' : ''} · ${formatDist(distance)} · ${formatDur(duration)}`,
    };
  }, [selected, effectiveTours]);

  const clearSelection = useCallback(() => {
    setSelected(new Map());
    setShiftAnchor(null);
  }, []);

  const selectOnly = useCallback((item: SidebarItem) => {
    const key = itemKey(item);
    const si = selectionItemFromSidebarItem(item);
    setSelected(new Map([[key, si]]));
    setShiftAnchor(null);
  }, []);

  const toggleSelect = useCallback((item: SidebarItem) => {
    const key = itemKey(item);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, selectionItemFromSidebarItem(item));
      return next;
    });
  }, []);

  const selectRange = useCallback(
    (fromIdx: number, toIdx: number) => {
      const lo = Math.min(fromIdx, toIdx);
      const hi = Math.max(fromIdx, toIdx);
      const next = new Map<SelectionItemKey, SelectionItem>();
      for (let i = lo; i <= hi; i++) {
        if (i >= 0 && i < flatItems.length) {
          const it = flatItems[i];
          next.set(itemKey(it), selectionItemFromSidebarItem(it));
        }
      }
      setSelected(next);
    },
    [flatItems],
  );

  const handlePlainClick = useCallback(
    (item: SidebarItem, index: number) => {
      setFocusIndex(index);
      selectOnly(item);
      setShiftAnchor(index);
      if (item.type === 'tour' && item.tour) {
        setActiveItem({ type: 'tour', path: item.path, tourId: item.tour.id });
      } else {
        setActiveItem({ type: 'folder', path: item.path });
      }
    },
    [selectOnly],
  );

  const handleCtrlClick = useCallback(
    (item: SidebarItem, index: number) => {
      setFocusIndex(index);
      toggleSelect(item);
      setShiftAnchor(index);
    },
    [toggleSelect],
  );

  const handleShiftClick = useCallback(
    (_item: SidebarItem, index: number) => {
      setFocusIndex(index);
      const anchor = shiftAnchor ?? index;
      selectRange(anchor, index);
    },
    [shiftAnchor, selectRange],
  );

  const activateFocused = useCallback(() => {
    if (focusIndex < 0 || focusIndex >= flatItems.length) return;
    const item = flatItems[focusIndex];
    if (item.type === 'tour' && item.tour) {
      setActiveItem({ type: 'tour', path: item.path, tourId: item.tour.id });
    } else {
      setActiveItem({ type: 'folder', path: item.path });
    }
  }, [focusIndex, flatItems]);

  const handleSpace = useCallback(() => {
    if (focusIndex < 0 || focusIndex >= flatItems.length) return;
    const item = flatItems[focusIndex];
    selectOnly(item);
    setShiftAnchor(focusIndex);
  }, [focusIndex, flatItems, selectOnly]);

  const handleCtrlSpace = useCallback(() => {
    if (focusIndex < 0 || focusIndex >= flatItems.length) return;
    const item = flatItems[focusIndex];
    toggleSelect(item);
    setShiftAnchor(focusIndex);
  }, [focusIndex, flatItems, toggleSelect]);

  const shiftAnchorRef = useRef(shiftAnchor);
  shiftAnchorRef.current = shiftAnchor;

  const handleShiftArrow = useCallback(
    (newFocusIndex: number) => {
      const anchor = shiftAnchorRef.current ?? focusIndex;
      if (shiftAnchorRef.current == null) {
        setShiftAnchor(focusIndex);
      }
      setFocusIndex(newFocusIndex);
      selectRange(anchor, newFocusIndex);
    },
    [focusIndex, selectRange],
  );

  const setActive = useCallback((item: SidebarSelectionState['activeItem']) => {
    setActiveItem(item);
  }, []);

  const startRename = useCallback(() => {
    if (focusIndex >= 0 && focusIndex < flatItems.length) {
      setRenamingItem(flatItems[focusIndex]);
    }
  }, [focusIndex, flatItems]);

  const startRenameFor = useCallback((item: SidebarItem) => {
    setRenamingItem(item);
  }, []);

  const finishRename = useCallback(
    (item: SidebarItem) => {
      setRenamingItem(null);
      // After rename the tree may have rebuilt — try to find the item
      // by its key; if not found (path changed), just clear rename state.
      const idx = flatItems.findIndex((fi) => itemKey(fi) === itemKey(item));
      if (idx >= 0) {
        setFocusIndex(idx);
        selectOnly(item);
        if (item.type === 'tour' && item.tour) {
          setActiveItem({
            type: 'tour',
            path: item.path,
            tourId: item.tour.id,
          });
        } else {
          setActiveItem({ type: 'folder', path: item.path });
        }
      }
      // If not found, selection/focus stay as-is (tree will rebuild)
    },
    [flatItems, selectOnly],
  );

  const cancelRename = useCallback(() => {
    setRenamingItem(null);
  }, []);

  return {
    focusIndex,
    setFocusIndex,
    selected,
    setSelected,
    activeItem,
    setActive,
    shiftAnchor,
    setShiftAnchor,
    flatItems,
    effectiveTours,
    selectionSummary,
    renamingItem,
    clearSelection,
    selectOnly,
    toggleSelect,
    selectRange,
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
  } as const;
}
