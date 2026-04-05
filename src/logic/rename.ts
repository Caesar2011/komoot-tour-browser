import type { Tour, TreeNode } from '../types.ts';

import { collectTours, findNode } from './tree.ts';

/** Result of a folder rename: the tour id and its new full name. */
export interface FolderRenameEntry {
  tourId: number;
  oldName: string;
  newName: string;
}

/**
 * Compute new file names for all tours inside a folder when the folder is renamed.
 * Tour names use " / " as path separator. Renaming folder "A / B" to "A / X"
 * means every tour whose name starts with "A / B / " or "A / B" (exact prefix)
 * gets that prefix replaced with "A / X".
 *
 * @param oldPath Slash-separated tree path of the folder being renamed (e.g. "A/B")
 * @param newFolderName The new name for the last segment only (e.g. "X")
 * @param tree The current tree root used to find all tours under the old path
 * @returns Array of entries with tourId, oldName, and newName
 */
export function computeFolderRenames(
  oldPath: string,
  newFolderName: string,
  tree: TreeNode,
): FolderRenameEntry[] {
  const node = findNode(tree, oldPath);
  if (!node) return [];

  const tours = collectTours(node);
  if (tours.length === 0) return [];

  const oldPrefix = pathToTourPrefix(oldPath);
  const segments = oldPath.split('/');
  segments[segments.length - 1] = newFolderName;
  const newPrefix = pathToTourPrefix(segments.join('/'));

  return tours.map((tour) => ({
    tourId: tour.id,
    oldName: tour.name,
    newName: replaceTourNamePrefix(tour.name, oldPrefix, newPrefix),
  }));
}

/**
 * Convert a tree path (e.g. "Alps/Tyrol") to the tour name prefix
 * that would appear in tour names (e.g. "Alps / Tyrol").
 */
export function pathToTourPrefix(treePath: string): string {
  if (!treePath) return '';
  return treePath.split('/').join(' / ');
}

/**
 * Replace the folder prefix portion of a tour name.
 * E.g. tour name "Alps / Tyrol / Summit" with oldPrefix "Alps / Tyrol"
 * and newPrefix "Alps / Dolomites" becomes "Alps / Dolomites / Summit".
 */
export function replaceTourNamePrefix(
  tourName: string,
  oldPrefix: string,
  newPrefix: string,
): string {
  if (!oldPrefix) return tourName;
  if (tourName === oldPrefix) return newPrefix;
  if (tourName.startsWith(oldPrefix + ' / ')) {
    return newPrefix + tourName.slice(oldPrefix.length);
  }
  return tourName;
}

/**
 * Compute new names for tours in a folder when the entire folder path is renamed.
 * This handles renaming at any depth, including intermediate segments.
 *
 * @param oldPath The old tree path (e.g. "Europe/Alps")
 * @param newPath The new tree path (e.g. "Europe/Dolomites")
 * @param tours All tours under the old folder
 */
export function computeFullPathRenames(
  oldPath: string,
  newPath: string,
  tours: Tour[],
): FolderRenameEntry[] {
  const oldPrefix = pathToTourPrefix(oldPath);
  const newPrefix = pathToTourPrefix(newPath);

  return tours.map((tour) => ({
    tourId: tour.id,
    oldName: tour.name,
    newName: replaceTourNamePrefix(tour.name, oldPrefix, newPrefix),
  }));
}
