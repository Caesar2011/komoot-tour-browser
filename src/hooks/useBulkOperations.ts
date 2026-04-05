import { useCallback, useRef, useState } from 'preact/hooks';

import type {
  BulkProgress,
  ExportFormat,
  SelectionItem,
  SelectionItemKey,
  ToastMessage,
  Tour,
  TreeNode,
} from '../types.ts';
import { Api } from '../logic/api.ts';
import { isOwnTour } from '../logic/utils.ts';
import { numericId } from '../logic/tourName.ts';
import {
  resolveEffectiveTours,
  computeMoveRenames,
} from '../logic/selection.ts';
import { downloadTour, downloadToursZip } from '../logic/export.ts';
import { collectTours } from '../logic/tree.ts';

let toastIdCounter = 0;

export function useBulkOperations(
  tree: TreeNode | null,
  applyTourUpdate: (tourId: number, updates: Partial<Tour>) => void,
  removeTour: (tourId: number) => void,
  setCustomName: (tourId: number, name: string) => Promise<void>,
) {
  const [progress, setProgress] = useState<BulkProgress | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const cancelledRef = useRef(false);

  const addToast = useCallback((type: 'success' | 'error', text: string) => {
    const id = ++toastIdCounter;
    const persistent = type === 'error';
    setToasts((prev) => [...prev, { id, type, text, persistent }]);
    if (!persistent) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    }
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const buildTourLookup = useCallback((): Map<number, Tour> => {
    if (!tree) return new Map();
    const all = collectTours(tree);
    return new Map(all.map((t) => [numericId(t), t]));
  }, [tree]);

  const bulkDelete = useCallback(
    async (
      selected: Map<SelectionItemKey, SelectionItem>,
      onComplete: () => void,
    ) => {
      const tours = resolveEffectiveTours(selected, tree);
      if (tours.length === 0) return;

      cancelledRef.current = false;
      setProgress({
        title: 'Deleting tours…',
        current: 0,
        total: tours.length,
        cancelled: false,
      });

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < tours.length; i++) {
        if (cancelledRef.current) break;
        try {
          await Api.deleteTour(tours[i].id);
          removeTour(tours[i].id);
          success++;
        } catch (e) {
          failed++;
          errors.push(
            `${tours[i].name}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        setProgress((p) => (p ? { ...p, current: i + 1 } : null));
      }

      setProgress(null);

      if (failed > 0) {
        addToast(
          'error',
          `${failed} of ${tours.length} deletions failed:\n${errors.join('\n')}`,
        );
      } else if (cancelledRef.current) {
        addToast(
          'success',
          `Cancelled. ${success} of ${tours.length} tours deleted.`,
        );
      } else {
        addToast(
          'success',
          `${success} tour${success !== 1 ? 's' : ''} deleted.`,
        );
      }

      onComplete();
    },
    [tree, removeTour, addToast],
  );

  const bulkMove = useCallback(
    async (
      selected: Map<SelectionItemKey, SelectionItem>,
      targetPath: string,
      onComplete: () => void,
    ) => {
      const renames = computeMoveRenames(selected, targetPath, tree);
      if (renames.length === 0) {
        onComplete();
        return;
      }

      const tourLookup = buildTourLookup();

      cancelledRef.current = false;
      setProgress({
        title: 'Moving tours…',
        current: 0,
        total: renames.length,
        cancelled: false,
      });

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < renames.length; i++) {
        if (cancelledRef.current) break;
        const { tourId, newName } = renames[i];
        const tour = tourLookup.get(numericId({ id: tourId }));
        const owned = tour ? isOwnTour(tour, Api.userId) : true;

        try {
          if (owned) {
            await Api.renameTour(tourId, newName);
            applyTourUpdate(tourId, { name: newName });
          } else {
            await setCustomName(numericId({ id: tourId }), newName);
          }
          success++;
        } catch (e) {
          failed++;
          errors.push(
            `Tour ${tourId}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        setProgress((p) => (p ? { ...p, current: i + 1 } : null));
      }

      setProgress(null);

      if (failed > 0) {
        addToast(
          'error',
          `${failed} of ${renames.length} moves failed:\n${errors.join('\n')}`,
        );
      } else if (cancelledRef.current) {
        addToast(
          'success',
          `Cancelled. ${success} of ${renames.length} tours moved.`,
        );
      } else {
        addToast(
          'success',
          `${success} tour${success !== 1 ? 's' : ''} moved.`,
        );
      }

      onComplete();
    },
    [tree, applyTourUpdate, setCustomName, addToast, buildTourLookup],
  );

  const bulkExport = useCallback(
    async (tours: Tour[], format: ExportFormat) => {
      if (tours.length === 0) return;

      if (tours.length === 1) {
        try {
          await downloadTour(tours[0].id, tours[0].name, format);
        } catch (e) {
          addToast(
            'error',
            `Export failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        return;
      }

      cancelledRef.current = false;
      setProgress({
        title: `Exporting ${format.toUpperCase()}…`,
        current: 0,
        total: tours.length,
        cancelled: false,
      });

      try {
        const success = await downloadToursZip(tours, 'tours', format, {
          onProgress: (current, total) => {
            setProgress((p) => (p ? { ...p, current, total } : null));
          },
          isCancelled: () => cancelledRef.current,
        });

        setProgress(null);

        if (cancelledRef.current) {
          addToast(
            'success',
            `Cancelled. ${success} of ${tours.length} tours exported.`,
          );
        } else {
          addToast(
            'success',
            `Exported ${success} tour${success !== 1 ? 's' : ''}.`,
          );
        }
      } catch (e) {
        setProgress(null);
        addToast(
          'error',
          `Export failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [addToast],
  );

  const cancelOperation = useCallback(() => {
    cancelledRef.current = true;
    setProgress((p) => (p ? { ...p, cancelled: true } : null));
  }, []);

  return {
    progress,
    toasts,
    bulkDelete,
    bulkMove,
    bulkExport,
    cancelOperation,
    addToast,
    dismissToast,
  } as const;
}
