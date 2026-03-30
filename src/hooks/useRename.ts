import { useCallback, useState } from 'preact/hooks';

import type { Tour } from '../types.ts';
import { Api } from '../logic/api.ts';

export function useRename(
  applyRenameToState: (tourId: number, newName: string) => void,
  updateDetailTourName: (tourId: number, newName: string) => void,
) {
  const [renamingTour, setRenamingTour] = useState<Tour | null>(null);

  const handleInlineRename = useCallback(
    async (tour: Tour, newName: string) => {
      await Api.renameTour(tour.id, newName);
      applyRenameToState(tour.id, newName);
      updateDetailTourName(tour.id, newName);
    },
    [applyRenameToState, updateDetailTourName],
  );

  const handleRenameSave = useCallback(
    async (newName: string) => {
      if (!renamingTour) return;
      await Api.renameTour(renamingTour.id, newName);
      applyRenameToState(renamingTour.id, newName);
      updateDetailTourName(renamingTour.id, newName);
      setRenamingTour(null);
    },
    [renamingTour, applyRenameToState, updateDetailTourName],
  );

  return {
    renamingTour,
    setRenamingTour,
    handleInlineRename,
    handleRenameSave,
  } as const;
}
