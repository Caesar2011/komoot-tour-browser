import { useCallback } from 'preact/hooks';

import type { Tour, TreeNode } from '../types.ts';
import { Api } from '../logic/api.ts';
import { isOwnTour } from '../logic/utils.ts';
import { computeFolderRenames } from '../logic/rename.ts';
import { renameTourUnified } from '../logic/tourName.ts';
import { collectTours, findNode } from '../logic/tree.ts';

export function useRename(
  applyTourUpdate: (tourId: number, updates: Partial<Tour>) => void,
  updateDetailTour: (tourId: number, updates: Partial<Tour>) => void,
  setCustomName: (tourId: number, name: string) => Promise<void>,
) {
  const handleInlineRename = useCallback(
    async (tour: Tour, newName: string) => {
      await renameTourUnified(
        tour,
        newName,
        Api.userId,
        setCustomName,
        applyTourUpdate,
        updateDetailTour,
      );
    },
    [applyTourUpdate, updateDetailTour, setCustomName],
  );

  const handleFolderRename = useCallback(
    async (oldPath: string, newFolderName: string, tree: TreeNode) => {
      const renames = computeFolderRenames(oldPath, newFolderName, tree);
      const node = findNode(tree, oldPath);
      const allToursInFolder = node ? collectTours(node) : [];
      const tourLookup = new Map(allToursInFolder.map((t) => [t.id, t]));

      await Promise.all(
        renames.map(async ({ tourId, newName }) => {
          const tour = tourLookup.get(tourId);
          if (!tour || isOwnTour(tour, Api.userId)) {
            await Api.renameTour(tourId, newName);
            applyTourUpdate(tourId, { name: newName });
            updateDetailTour(tourId, { name: newName });
          } else {
            await setCustomName(tour.id, newName);
          }
        }),
      );
    },
    [applyTourUpdate, updateDetailTour, setCustomName],
  );

  return { handleInlineRename, handleFolderRename };
}
