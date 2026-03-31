import { useCallback, useState } from 'preact/hooks';

import type { Tour, TreeNode } from '../types.ts';
import { Api } from '../logic/api.ts';
import { computeFolderRenames } from '../logic/rename.ts';

export function useRename(
  applyTourUpdate: (tourId: number, updates: Partial<Tour>) => void,
  updateDetailTour: (tourId: number, updates: Partial<Tour>) => void,
) {
  const [renamingTour, setRenamingTour] = useState<Tour | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);

  const handleInlineRename = useCallback(
    async (tour: Tour, newName: string) => {
      await Api.renameTour(tour.id, newName);
      applyTourUpdate(tour.id, { name: newName });
      updateDetailTour(tour.id, { name: newName });
    },
    [applyTourUpdate, updateDetailTour],
  );

  const handleRenameSave = useCallback(
    async (newName: string) => {
      if (!renamingTour) return;
      await Api.renameTour(renamingTour.id, newName);
      applyTourUpdate(renamingTour.id, { name: newName });
      updateDetailTour(renamingTour.id, { name: newName });
      setRenamingTour(null);
    },
    [renamingTour, applyTourUpdate, updateDetailTour],
  );

  const handleFolderRename = useCallback(
    async (oldPath: string, newFolderName: string, tree: TreeNode) => {
      const renames = computeFolderRenames(oldPath, newFolderName, tree);
      // Execute all renames in parallel
      await Promise.all(
        renames.map(async ({ tourId, newName }) => {
          await Api.renameTour(tourId, newName);
          applyTourUpdate(tourId, { name: newName });
          updateDetailTour(tourId, { name: newName });
        }),
      );
      setRenamingFolder(null);
    },
    [applyTourUpdate, updateDetailTour],
  );

  return {
    renamingTour,
    setRenamingTour,
    renamingFolder,
    setRenamingFolder,
    handleInlineRename,
    handleRenameSave,
    handleFolderRename,
  } as const;
}
