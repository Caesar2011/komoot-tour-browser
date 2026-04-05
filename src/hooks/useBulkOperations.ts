import { useCallback, useRef, useState } from 'preact/hooks';
import { zipSync } from 'fflate';

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
import {
  resolveEffectiveTours,
  computeMoveRenames,
} from '../logic/selection.ts';
import { triggerDownload } from '../logic/utils.ts';

let toastIdCounter = 0;

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function makeZipBlob(entries: { name: string; content: Uint8Array }[]): Blob {
  const files: Parameters<typeof zipSync>[0] = {};
  for (const { name, content } of entries) {
    files[name] = [content, { level: 6 }];
  }
  return new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
    type: 'application/zip',
  });
}

export function useBulkOperations(
  tree: TreeNode | null,
  applyTourUpdate: (tourId: number, updates: Partial<Tour>) => void,
  removeTour: (tourId: number) => void,
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
      if (renames.length === 0) return;

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
        try {
          await Api.renameTour(renames[i].tourId, renames[i].newName);
          applyTourUpdate(renames[i].tourId, { name: renames[i].newName });
          success++;
        } catch (e) {
          failed++;
          errors.push(
            `Tour ${renames[i].tourId}: ${e instanceof Error ? e.message : String(e)}`,
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
    [tree, applyTourUpdate, addToast],
  );

  const bulkExport = useCallback(
    async (tours: Tour[], format: ExportFormat) => {
      if (tours.length === 0) return;

      // Single-tour fast path — no zip needed
      if (tours.length === 1) {
        const tour = tours[0];
        const safeName = (tour.name || 'tour').replace(
          /[^a-zA-Z0-9_\-. ]/g,
          '_',
        );
        const blob =
          format === 'gpx'
            ? await Api.downloadGpx(tour.id)
            : await Api.downloadFit(tour.id);
        triggerDownload(blob, `${safeName}.${format}`);
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
        const entries: { name: string; content: Uint8Array }[] = [];
        const nameCount = new Map<string, number>();
        let success = 0;

        for (let i = 0; i < tours.length; i++) {
          if (cancelledRef.current) break;
          try {
            const blob =
              format === 'gpx'
                ? await Api.downloadGpx(tours[i].id)
                : await Api.downloadFit(tours[i].id);

            const baseName =
              (tours[i]._leafName || tours[i].name || 'tour').replace(
                /[^a-zA-Z0-9_\-. ]/g,
                '_',
              ) + `.${format}`;

            const count = nameCount.get(baseName) ?? 0;
            nameCount.set(baseName, count + 1);

            const dot = baseName.lastIndexOf('.');
            const uniqueName =
              count === 0
                ? baseName
                : `${baseName.slice(0, dot)}_${count}${baseName.slice(dot)}`;

            entries.push({
              name: uniqueName,
              content: await blobToUint8Array(blob),
            });
            success++;
          } catch {
            // Skip failed downloads silently
          }
          setProgress((p) => (p ? { ...p, current: i + 1 } : null));
        }

        triggerDownload(makeZipBlob(entries), `tours.${format}.zip`);

        setProgress(null);
        addToast(
          'success',
          `Exported ${success} tour${success !== 1 ? 's' : ''}.`,
        );
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
