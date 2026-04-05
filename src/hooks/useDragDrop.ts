import { useCallback, useRef, useState } from 'preact/hooks';

import type { SelectionItem, SelectionItemKey, SidebarItem } from '../types.ts';
import { itemKey, isFolderInSelection } from '../logic/selection.ts';

const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD_PX = 5;

export interface DragDropState {
  isDragging: boolean;
  dragOverPath: string | null;
}

export function useDragDrop(
  selected: Map<SelectionItemKey, SelectionItem>,
  selectOnly: (item: SidebarItem) => void,
  toggleSelect: (item: SidebarItem) => void,
  onDrop: (targetPath: string) => void,
) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDragActiveRef = useRef(false);
  const longPressFiredRef = useRef(false);
  /** Set to true after long-press to suppress the next click event. */
  const suppressClickRef = useRef(false);

  /** Call this from click handlers to check if the click should be suppressed. */
  const shouldSuppressClick = useCallback((): boolean => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  const isValidDropTarget = useCallback(
    (folderPath: string) => {
      if (selected.size === 0) return false;
      return !isFolderInSelection(folderPath, selected);
    },
    [selected],
  );

  // --- Desktop DnD via native HTML5 ---

  const handleDragStart = useCallback(
    (e: DragEvent, item: SidebarItem) => {
      const key = itemKey(item);
      if (!selected.has(key)) {
        selectOnly(item);
      }
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.setData('text/plain', 'move');
      setIsDragging(true);
    },
    [selected, selectOnly],
  );

  const handleDragOver = useCallback(
    (e: DragEvent, folderPath: string) => {
      if (isValidDropTarget(folderPath)) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        setDragOverPath(folderPath);
      }
    },
    [isValidDropTarget],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverPath(null);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent, folderPath: string) => {
      e.preventDefault();
      setDragOverPath(null);
      setIsDragging(false);
      if (isValidDropTarget(folderPath)) {
        onDrop(folderPath);
      }
    },
    [isValidDropTarget, onDrop],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragOverPath(null);
  }, []);

  // --- Touch DnD (two-stage: long press + move OR long press + release = select) ---

  const longPressItemRef = useRef<SidebarItem | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent, item: SidebarItem) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      touchDragActiveRef.current = false;
      longPressFiredRef.current = false;
      longPressItemRef.current = item;

      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;

        // Ensure the item is selected (add to selection for drag)
        const key = itemKey(item);
        if (!selected.has(key)) {
          toggleSelect(item);
        }

        // Mark ready for drag on subsequent touchmove
        touchDragActiveRef.current = true;
        setIsDragging(true);

        if (navigator.vibrate) navigator.vibrate(30);
      }, LONG_PRESS_MS);
    },
    [selected, toggleSelect],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const start = touchStartRef.current;
      if (!start) return;

      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - start.x);
      const dy = Math.abs(touch.clientY - start.y);

      // Cancel long press if moved before threshold
      if (
        !longPressFiredRef.current &&
        (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX)
      ) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        return;
      }

      if (touchDragActiveRef.current) {
        e.preventDefault();
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const dropZone = el?.closest('[data-drop-path]') as HTMLElement | null;
        if (dropZone) {
          const path = dropZone.dataset.dropPath ?? '';
          if (isValidDropTarget(path)) {
            setDragOverPath(path);
          } else {
            setDragOverPath(null);
          }
        } else {
          setDragOverPath(null);
        }
      }
    },
    [isValidDropTarget],
  );

  const handleTouchEnd = useCallback(
    (_e: TouchEvent) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const wasDragging = touchDragActiveRef.current;
      const wasLongPress = longPressFiredRef.current;

      if (wasDragging && dragOverPath != null) {
        // Perform drop
        onDrop(dragOverPath);
      }

      // If long press fired (whether drag happened or just release),
      // suppress the subsequent click event so it doesn't do a plain-click activate.
      if (wasLongPress) {
        suppressClickRef.current = true;
      }

      touchStartRef.current = null;
      touchDragActiveRef.current = false;
      longPressFiredRef.current = false;
      longPressItemRef.current = null;
      setIsDragging(false);
      setDragOverPath(null);
    },
    [dragOverPath, onDrop],
  );

  const cancelTouch = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartRef.current = null;
    touchDragActiveRef.current = false;
    longPressFiredRef.current = false;
    longPressItemRef.current = null;
    setIsDragging(false);
    setDragOverPath(null);
  }, []);

  return {
    isDragging,
    dragOverPath,
    isValidDropTarget,
    shouldSuppressClick,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    cancelTouch,
  } as const;
}
