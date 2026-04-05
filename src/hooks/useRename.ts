import { useCallback } from 'preact/hooks';

import type { Tour, TreeNode } from '../types.ts';
import { Api } from '../logic/api.ts';
import { isOwnTour } from '../logic/utils.ts';
import { computeFolderRenames } from '../logic/rename.ts';
import { renameTourUnified, numericId } from '../logic/tourName.ts';

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
      await Promise.all(
        renames.map(async ({ tourId, newName }) => {
          // Tours in the tree are display-name-substituted, so we need to
          // find the actual tour to check ownership. The tree stores the
          // (possibly substituted) tour objects.
          // For folder renames, only own tours are in scope — foreign tours
          // are custom-name-substituted and appear under potentially different
          // folders, but the rename computation includes all tours under the
          // folder node. We handle both.
          const fakeForOwnerCheck = {
            id: tourId,
            _embedded: undefined,
          } as Tour;
          if (isOwnTour(fakeForOwnerCheck, Api.userId)) {
            await Api.renameTour(tourId, newName);
            applyTourUpdate(tourId, { name: newName });
            updateDetailTour(tourId, { name: newName });
          } else {
            await setCustomName(numericId({ id: tourId }), newName);
          }
        }),
      );
    },
    [applyTourUpdate, updateDetailTour, setCustomName],
  );

  return {
    handleInlineRename,
    handleFolderRename,
  } as const;
}
