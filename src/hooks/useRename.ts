import { useCallback } from 'preact/hooks';

import type { Tour, TreeNode } from '../types.ts';
import { Api } from '../logic/api.ts';
import { computeFolderRenames } from '../logic/rename.ts';

export function useRename(
  applyTourUpdate: (tourId: number, updates: Partial<Tour>) => void,
  updateDetailTour: (tourId: number, updates: Partial<Tour>) => void,
) {
  const handleInlineRename = useCallback(
    async (tour: Tour, newName: string) => {
      await Api.renameTour(tour.id, newName);
      applyTourUpdate(tour.id, { name: newName });
      updateDetailTour(tour.id, { name: newName });
    },
    [applyTourUpdate, updateDetailTour],
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
