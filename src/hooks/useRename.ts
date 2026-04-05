import { useCallback } from 'preact/hooks';

import type { Tour, TreeNode } from '../types.ts';
import { Api } from '../logic/api.ts';
import { isOwnTour } from '../logic/utils.ts';
import { computeFolderRenames } from '../logic/rename.ts';

export function useRename(
  applyTourUpdate: (tourId: number, updates: Partial<Tour>) => void,
  updateDetailTour: (tourId: number, updates: Partial<Tour>) => void,
  setCustomName?: (tourId: number, name: string) => Promise<void>,
) {
  const handleInlineRename = useCallback(
    async (tour: Tour, newName: string) => {
      if (isOwnTour(tour, Api.userId)) {
        await Api.renameTour(tour.id, newName);
        applyTourUpdate(tour.id, { name: newName });
        updateDetailTour(tour.id, { name: newName });
      } else if (setCustomName) {
        // Foreign tour → store as custom name (empty string = delete mapping)
        await setCustomName(tour.id, newName);
        // Do NOT mutate allTours; applyCustomNames handles display
      }
    },
    [applyTourUpdate, updateDetailTour, setCustomName],
  );

  const handleFolderRename = useCallback(
    async (oldPath: string, newFolderName: string, tree: TreeNode) => {
      const renames = computeFolderRenames(oldPath, newFolderName, tree);
      await Promise.all(
        renames.map(async ({ tourId, newName }) => {
          await Api.renameTour(tourId, newName);
          applyTourUpdate(tourId, { name: newName });
          updateDetailTour(tourId, { name: newName });
        }),
      );
    },
    [applyTourUpdate, updateDetailTour],
  );

  return {
    handleInlineRename,
    handleFolderRename,
  } as const;
}
