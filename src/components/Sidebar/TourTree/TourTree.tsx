import { useEffect, useRef, useState } from 'preact/hooks';

import type {
  SelectionItem,
  SelectionItemKey,
  SidebarItem,
  Tour,
  TreeNode,
} from '../../../types.ts';
import { sportIcon, isOwnTour } from '../../../logic/utils.ts';
import { countTours } from '../../../logic/tree.ts';
import { itemKey } from '../../../logic/selection.ts';
import { hasCustomName as checkCustomName } from '../../../logic/tourName.ts';

import styles from './TourTree.module.css';

interface Props {
  node: TreeNode;
  depth: number;
  isRoot?: boolean;
  activeItem: { type: 'folder' | 'tour'; path: string; tourId?: number } | null;
  selected: Map<SelectionItemKey, SelectionItem>;
  openPaths: Set<string>;
  focusedIndex: number;
  flatItems: SidebarItem[];
  renamingItem: SidebarItem | null;
  dragOverPath: string | null;
  isDragging: boolean;
  userId: string;
  customNames: Map<number, string>;
  onItemClick: (e: MouseEvent, item: SidebarItem, index: number) => void;
  onItemDoubleClick: (e: MouseEvent, item: SidebarItem) => void;
  onArrowClick: (e: MouseEvent, item: SidebarItem) => void;
  onInlineRename: (tour: Tour, newName: string) => Promise<void>;
  onFolderRename: (oldPath: string, newName: string) => Promise<void>;
  onCancelRename: () => void;
  onFinishRename: (item: SidebarItem) => void;
  onDragStart: (e: DragEvent, item: SidebarItem) => void;
  onDragOver: (e: DragEvent, folderPath: string) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent, folderPath: string) => void;
  onDragEnd: () => void;
  onTouchStart: (e: TouchEvent, item: SidebarItem) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

function findFlatIndex(flatItems: SidebarItem[], item: SidebarItem): number {
  const key = itemKey(item);
  return flatItems.findIndex((fi) => itemKey(fi) === key);
}

export function TourTree({
  node,
  depth,
  isRoot = false,
  activeItem,
  selected,
  openPaths,
  focusedIndex,
  flatItems,
  renamingItem,
  dragOverPath,
  isDragging,
  userId,
  customNames,
  onItemClick,
  onItemDoubleClick,
  onArrowClick,
  onInlineRename,
  onFolderRename,
  onCancelRename,
  onFinishRename,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: Props) {
  const childKeys = [...node.children.keys()].sort((a, b) =>
    a.localeCompare(b),
  );
  const hasKids = childKeys.length > 0 || node.tours.length > 0;
  const total = countTours(node);
  const isOpen = openPaths.has(node.path);

  const folderItem: SidebarItem = { type: 'folder', path: node.path, depth };
  const folderKey = itemKey(folderItem);
  const flatIdx = findFlatIndex(flatItems, folderItem);
  const isFolderSelected = selected.has(folderKey);
  const isFolderActive =
    activeItem?.type === 'folder' && activeItem.path === node.path;
  const isFocused = focusedIndex === flatIdx && flatIdx >= 0;
  const isDropTarget = dragOverPath === node.path;
  const isRenamingThis =
    renamingItem?.type === 'folder' && renamingItem.path === node.path;

  const classes = [
    styles.label,
    isFolderSelected ? styles.selected : '',
    isFolderActive ? styles.active : '',
    isFocused ? styles.focused : '',
    isDropTarget ? styles.dropTarget : '',
  ]
    .filter(Boolean)
    .join(' ');

  const sharedProps = {
    activeItem,
    selected,
    openPaths,
    focusedIndex,
    flatItems,
    renamingItem,
    dragOverPath,
    isDragging,
    userId,
    customNames,
    onItemClick,
    onItemDoubleClick,
    onArrowClick,
    onInlineRename,
    onFolderRename,
    onCancelRename,
    onFinishRename,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
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
          class={classes}
          style={{ paddingLeft: `${depth * 16 + 10}px` }}
          data-sidebar-index
          data-drop-path={node.path}
          draggable={!isRoot && !isRenamingThis}
          onClick={(e: MouseEvent) => {
            if (!isRenamingThis) onItemClick(e, folderItem, flatIdx);
          }}
          onDblClick={(e: MouseEvent) => {
            if (!isRoot && !isRenamingThis) onItemDoubleClick(e, folderItem);
          }}
          onDragStart={(e: DragEvent) => onDragStart(e, folderItem)}
          onDragOver={(e: DragEvent) => onDragOver(e, node.path)}
          onDragLeave={onDragLeave}
          onDrop={(e: DragEvent) => onDrop(e, node.path)}
          onDragEnd={onDragEnd}
          onTouchStart={(e: TouchEvent) => {
            if (!isRenamingThis) onTouchStart(e, folderItem);
          }}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span
            class={`${styles.toggle} ${isOpen ? styles.open : ''}`}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              onArrowClick(e, folderItem);
            }}
            onDblClick={(e: MouseEvent) => e.stopPropagation()}
          >
            {hasKids ? '▶' : ''}
          </span>
          <span class={styles.icon}>{isRoot ? '🏠' : '📁'}</span>
          {isRenamingThis ? (
            <InlineRenameInput
              initialValue={node.name}
              onSave={async (newName) => {
                await onFolderRename(node.path, newName);
                onFinishRename(folderItem);
              }}
              onCancel={onCancelRename}
            />
          ) : (
            <span class={styles.name}>{isRoot ? 'All Tours' : node.name}</span>
          )}
          {!isRenamingThis && <span class={styles.count}>{total}</span>}
        </div>

        {isOpen && (
          <ul role="group">
            {childKeys.map((key) => (
              <TourTree
                key={key}
                node={node.children.get(key)!}
                depth={depth + 1}
                {...sharedProps}
              />
            ))}
            {node.tours.map((tour) => (
              <TourTreeItem
                key={tour.id}
                tour={tour}
                depth={depth}
                folderPath={node.path}
                activeItem={activeItem}
                selected={selected}
                focusedIndex={focusedIndex}
                flatItems={flatItems}
                renamingItem={renamingItem}
                userId={userId}
                customNames={customNames}
                onItemClick={onItemClick}
                onItemDoubleClick={onItemDoubleClick}
                onInlineRename={onInlineRename}
                onCancelRename={onCancelRename}
                onFinishRename={onFinishRename}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
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
  activeItem: { type: 'folder' | 'tour'; path: string; tourId?: number } | null;
  selected: Map<SelectionItemKey, SelectionItem>;
  focusedIndex: number;
  flatItems: SidebarItem[];
  renamingItem: SidebarItem | null;
  userId: string;
  customNames: Map<number, string>;
  onItemClick: (e: MouseEvent, item: SidebarItem, index: number) => void;
  onItemDoubleClick: (e: MouseEvent, item: SidebarItem) => void;
  onInlineRename: (tour: Tour, newName: string) => Promise<void>;
  onCancelRename: () => void;
  onFinishRename: (item: SidebarItem) => void;
  onDragStart: (e: DragEvent, item: SidebarItem) => void;
  onDragEnd: () => void;
  onTouchStart: (e: TouchEvent, item: SidebarItem) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

function TourTreeItem({
  tour,
  depth,
  folderPath,
  activeItem,
  selected,
  focusedIndex,
  flatItems,
  renamingItem,
  userId,
  customNames,
  onItemClick,
  onItemDoubleClick,
  onInlineRename,
  onCancelRename,
  onFinishRename,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: ItemProps) {
  const sidebarItem: SidebarItem = {
    type: 'tour',
    path: folderPath,
    tour,
    depth: depth + 1,
  };
  const key = itemKey(sidebarItem);
  const flatIdx = findFlatIndex(flatItems, sidebarItem);
  const isTourSelected = selected.has(key);
  const isTourActive =
    activeItem?.type === 'tour' && activeItem.tourId === tour.id;
  const isRecorded = tour.type === 'tour_recorded';
  const isFocused = focusedIndex === flatIdx && flatIdx >= 0;
  const isRenamingThis =
    renamingItem?.type === 'tour' && renamingItem.tour?.id === tour.id;

  const owned = isOwnTour(tour, userId);
  const hasCustom = checkCustomName(tour, customNames, userId);

  const classes = [
    styles.label,
    isTourSelected ? styles.selected : '',
    isTourActive ? styles.active : '',
    isRecorded ? styles.recorded : '',
    isFocused ? styles.focused : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Own tours: full name for inline rename. Foreign: custom name if set.
  const renameInitialValue = owned
    ? tour.name
    : (customNames.get(tour.id) ?? tour.name);

  return (
    <li
      role="treeitem"
      aria-selected={isTourSelected}
      aria-label={`${tour._leafName || tour.name || 'Unnamed'}, ${tour.sport}, ${isRecorded ? 'recorded' : 'planned'}`}
    >
      <div
        class={classes}
        style={{ paddingLeft: `${(depth + 1) * 16 + 10}px` }}
        title={tour.name}
        data-sidebar-index
        draggable={!isRenamingThis}
        onClick={(e: MouseEvent) => {
          if (!isRenamingThis) {
            e.stopPropagation();
            onItemClick(e, sidebarItem, flatIdx);
          }
        }}
        onDblClick={(e: MouseEvent) => {
          if (!isRenamingThis) onItemDoubleClick(e, sidebarItem);
        }}
        onDragStart={(e: DragEvent) => onDragStart(e, sidebarItem)}
        onDragEnd={onDragEnd}
        onTouchStart={(e: TouchEvent) => {
          if (!isRenamingThis) onTouchStart(e, sidebarItem);
        }}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span class={styles.toggle} />
        <span class={styles.icon}>{sportIcon(tour.sport)}</span>
        {isRenamingThis ? (
          <InlineRenameInput
            initialValue={renameInitialValue}
            allowEmpty={!owned}
            onSave={async (newName) => {
              await onInlineRename(tour, newName);
              onFinishRename(sidebarItem);
            }}
            onCancel={onCancelRename}
          />
        ) : (
          <span class={styles.name}>
            {tour._leafName || tour.name || 'Unnamed'}
          </span>
        )}
        {!isRenamingThis && hasCustom && (
          <span class={styles.customNameIcon} title="Custom name applied">
            🏷️
          </span>
        )}
        {!isRenamingThis && (
          <span class={styles.statusEmoji} title={tour.status ?? 'unknown'}>
            {statusEmoji(tour.status)}
          </span>
        )}
      </div>
    </li>
  );
}

interface InlineRenameProps {
  initialValue: string;
  allowEmpty?: boolean;
  onSave: (newName: string) => Promise<void>;
  onCancel: () => void;
}

function InlineRenameInput({
  initialValue,
  allowEmpty = false,
  onSave,
  onCancel,
}: InlineRenameProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const blurIgnoreRef = useRef(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const id = setTimeout(() => {
      el.focus();
      el.setSelectionRange(0, el.value.length);
    }, 20);
    return () => clearTimeout(id);
  }, []);

  const doSave = async () => {
    const trimmed = value.trim();
    if (!allowEmpty && (!trimmed || trimmed === initialValue)) {
      onCancel();
      return;
    }
    if (allowEmpty && trimmed === initialValue) {
      onCancel();
      return;
    }
    setSaving(true);
    blurIgnoreRef.current = true;
    try {
      await onSave(trimmed);
    } catch {
      onCancel();
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      doSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    if (blurIgnoreRef.current || saving) return;
    onCancel();
  };

  return (
    <input
      ref={inputRef}
      class={styles.renameInput}
      type="text"
      value={value}
      disabled={saving}
      onInput={(e) => setValue((e.target as HTMLInputElement).value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onClick={(e: MouseEvent) => e.stopPropagation()}
      onDblClick={(e: MouseEvent) => e.stopPropagation()}
      onMouseDown={(e: MouseEvent) => e.stopPropagation()}
    />
  );
}
