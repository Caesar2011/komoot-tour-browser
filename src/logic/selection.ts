import type {
  SelectionItem,
  SelectionItemKey,
  SidebarItem,
  Tour,
  TreeNode,
} from '../types.ts';

import { collectTours, findNode } from './tree.ts';

/** Generate a unique key for a sidebar item. */
export function itemKey(item: SidebarItem): SelectionItemKey {
  return item.type === 'tour' && item.tour
    ? `tour:${item.tour.id}`
    : `folder:${item.path}`;
}

export function selectionItemFromSidebarItem(item: SidebarItem): SelectionItem {
  return item.type === 'tour' && item.tour
    ? { type: 'tour', path: item.path, tourId: item.tour.id }
    : { type: 'folder', path: item.path };
}

export function itemKeyFromSelectionItem(si: SelectionItem): SelectionItemKey {
  return si.type === 'tour' && si.tourId != null
    ? `tour:${si.tourId}`
    : `folder:${si.path}`;
}

/**
 * Resolve the effective set of tours from a selection, deduplicating
 * children whose parent folder is also selected.
 */
export function resolveEffectiveTours(
  selected: Map<SelectionItemKey, SelectionItem>,
  tree: TreeNode | null,
): Tour[] {
  if (!tree) return [];

  // Collect selected folder paths
  const selectedFolderPaths: string[] = [];
  for (const item of selected.values()) {
    if (item.type === 'folder') selectedFolderPaths.push(item.path);
  }

  // Remove folders whose ancestor is also selected
  const effectiveFolderPaths = selectedFolderPaths.filter((p) => {
    return !selectedFolderPaths.some(
      (other) => other !== p && p.startsWith(other + '/'),
    );
  });

  const tourIds = new Set<number>();
  const tours: Tour[] = [];

  // Add tours from effective folders
  for (const fp of effectiveFolderPaths) {
    const node = findNode(tree, fp);
    if (!node) continue;
    for (const t of collectTours(node)) {
      if (!tourIds.has(t.id)) {
        tourIds.add(t.id);
        tours.push(t);
      }
    }
  }

  // Add individually selected tours not already covered
  for (const item of selected.values()) {
    if (
      item.type === 'tour' &&
      item.tourId != null &&
      !tourIds.has(item.tourId)
    ) {
      // Check if this tour's folder is already covered
      const isCovered = effectiveFolderPaths.some(
        (fp) => item.path === fp || item.path.startsWith(fp + '/'),
      );
      if (isCovered) continue;

      // Find the tour in the tree
      const node = findNode(tree, item.path);
      if (node) {
        const tour = node.tours.find((t) => t.id === item.tourId);
        if (tour) {
          tourIds.add(tour.id);
          tours.push(tour);
        }
      }
    }
  }

  return tours;
}

/** Check if a folder path is part of the current selection (exact or ancestor). */
export function isFolderInSelection(
  folderPath: string,
  selected: Map<SelectionItemKey, SelectionItem>,
): boolean {
  for (const item of selected.values()) {
    if (item.type === 'folder') {
      if (item.path === folderPath) return true;
      if (folderPath.startsWith(item.path + '/')) return true;
    }
  }
  return false;
}

/** Check if a specific sidebar item is selected. */
export function isItemSelected(
  item: SidebarItem,
  selected: Map<SelectionItemKey, SelectionItem>,
): boolean {
  return selected.has(itemKey(item));
}

/**
 * Compute move renames: for each effective tour, compute the new name
 * when moved to targetPath.
 */
export function computeMoveRenames(
  selected: Map<SelectionItemKey, SelectionItem>,
  targetPath: string,
  tree: TreeNode | null,
): { tourId: number; newName: string }[] {
  if (!tree) return [];

  const renames: { tourId: number; newName: string }[] = [];
  const targetPrefix = targetPath ? targetPath.split('/').join(' / ') : '';

  // Process each selected item
  for (const item of selected.values()) {
    if (item.type === 'tour' && item.tourId != null) {
      const node = findNode(tree, item.path);
      if (!node) continue;
      const tour = node.tours.find((t) => t.id === item.tourId);
      if (!tour) continue;
      const leafName =
        tour._leafName || tour.name.split(' / ').pop() || tour.name;
      const newName = targetPrefix ? `${targetPrefix} / ${leafName}` : leafName;
      renames.push({ tourId: tour.id, newName });
    } else if (item.type === 'folder') {
      const node = findNode(tree, item.path);
      if (!node) continue;
      const folderName = node.name;
      const folderTours = collectTours(node);
      const oldPrefix = item.path.split('/').join(' / ');

      for (const tour of folderTours) {
        // Compute the part after the folder prefix
        const tourPrefix = tour.name;
        let innerPart: string;
        if (tourPrefix.startsWith(oldPrefix + ' / ')) {
          innerPart = tourPrefix.slice(oldPrefix.length + 3);
        } else if (tourPrefix === oldPrefix) {
          innerPart = '';
        } else {
          innerPart =
            tour._leafName || tour.name.split(' / ').pop() || tour.name;
        }

        let newName: string;
        if (targetPrefix) {
          newName = innerPart
            ? `${targetPrefix} / ${folderName} / ${innerPart}`
            : `${targetPrefix} / ${folderName}`;
        } else {
          newName = innerPart ? `${folderName} / ${innerPart}` : folderName;
        }
        renames.push({ tourId: tour.id, newName });
      }
    }
  }

  return renames;
}
