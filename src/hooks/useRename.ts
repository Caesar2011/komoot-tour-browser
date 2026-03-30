import { useCallback, useState } from 'preact/hooks';

import type { Tour } from '../types.ts';
import { Api } from '../logic/api.ts';

export function useRename(
  applyTourUpdate: (tourId: number, updates: Partial<Tour>) => void,
  updateDetailTour: (tourId: number, updates: Partial<Tour>) => void,
) {
  const [renamingTour, setRenamingTour] = useState<Tour | null>(null);

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

  return {
    renamingTour,
    setRenamingTour,
    handleInlineRename,
    handleRenameSave,
  } as const;
}
