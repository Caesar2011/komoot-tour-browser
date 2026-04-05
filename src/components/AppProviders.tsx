import type { ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';

import type {
  ExportFormat,
  FolderContext,
  Tour,
  TourStatus,
} from '../types.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useTours } from '../hooks/useTours.ts';
import { useCustomNames } from '../hooks/useCustomNames.ts';
import { useSelection } from '../hooks/useSelection.ts';
import { useRename } from '../hooks/useRename.ts';
import { useUpload } from '../hooks/useUpload.ts';
import { useSidebarSelection } from '../hooks/useSidebarSelection.ts';
import { useBulkOperations } from '../hooks/useBulkOperations.ts';
import { useDragDrop } from '../hooks/useDragDrop.ts';
import { Api, ForbiddenError } from '../logic/api.ts';
import { isOwnTour } from '../logic/utils.ts';
import { resolveEffectiveTours } from '../logic/selection.ts';
import { komootTourUrl, komootFolderUrl } from '../logic/komoot.ts';
import { collectTours, findNode } from '../logic/tree.ts';
import { AppContext, type AppContextValue } from '../contexts/AppContext.ts';

import { ConfirmDialog } from './ConfirmDialog/ConfirmDialog.tsx';
import { FallbackRenameDialog } from './FallbackRenameDialog/FallbackRenameDialog.tsx';
import { BulkProgressDialog } from './BulkProgressDialog/BulkProgressDialog.tsx';
import { UploadDialog } from './UploadDialog/UploadDialog.tsx';
import { MappingDialog } from './MappingDialog/MappingDialog.tsx';
import { ToastContainer } from './ToastContainer/ToastContainer.tsx';

interface Props {
  children: ComponentChildren;
}

export function AppProviders({ children }: Props) {
  const auth = useAuth();
  const customNameHook = useCustomNames();

  const tours = useTours(
    auth.authenticated,
    auth.handleAuthError,
    customNameHook.customNames,
    Api.userId,
  );

  const sel = useSelection(tours.tree, tours.allTours, auth.handleAuthError);
  const rename = useRename(
    tours.applyTourUpdate,
    sel.updateDetailTour,
    customNameHook.setCustomName,
  );
  const upload = useUpload(tours.addTour);
  const sidebarSel = useSidebarSelection(tours.tree, sel.openPaths);
  const bulk = useBulkOperations(
    tours.tree,
    tours.applyTourUpdate,
    tours.removeTour,
    customNameHook.setCustomName,
  );

  const [lastExportFormat, setLastExportFormat] = useState<ExportFormat>('gpx');
  const [deleteTargetTours, setDeleteTargetTours] = useState<Tour[]>([]);
  const [fallbackRenameTour, setFallbackRenameTour] = useState<Tour | null>(
    null,
  );

  const handleDrop = useCallback(
    (targetPath: string) => {
      bulk.bulkMove(sidebarSel.selected, targetPath, () => {
        sidebarSel.clearSelection();
      });
    },
    [bulk, sidebarSel],
  );

  const dragDrop = useDragDrop(
    sidebarSel.selected,
    sidebarSel.selectOnly,
    sidebarSel.toggleSelect,
    handleDrop,
  );

  const handlePatchTour = useCallback(
    async (
      tourId: number,
      fields: Partial<{ sport: string; status: TourStatus }>,
    ) => {
      try {
        await Api.patchTour(tourId, fields);
        tours.applyTourUpdate(tourId, fields as Partial<Tour>);
        sel.updateDetailTour(tourId, fields as Partial<Tour>);
      } catch (e) {
        if (e instanceof ForbiddenError) throw e;
        throw e;
      }
    },
    [tours, sel],
  );

  const handleActivateItem = useCallback(
    async (type: 'folder' | 'tour', path: string, tourId?: number) => {
      await sel.handleActivateItem(type, path, tourId);
    },
    [sel],
  );

  const handleInlineRename = useCallback(
    async (tour: Tour, newName: string) => {
      await rename.handleInlineRename(tour, newName);
    },
    [rename],
  );

  const handleFolderRename = useCallback(
    async (oldPath: string, newName: string) => {
      if (!tours.tree) return;
      await rename.handleFolderRename(oldPath, newName, tours.tree);
    },
    [rename, tours.tree],
  );

  const handleBulkDelete = useCallback(() => {
    const effective = resolveEffectiveTours(sidebarSel.selected, tours.tree);
    if (effective.length === 0) return;
    setDeleteTargetTours(effective);
  }, [sidebarSel.selected, tours.tree]);

  const handleBulkExport = useCallback(
    (format: ExportFormat) => {
      const effective = resolveEffectiveTours(sidebarSel.selected, tours.tree);
      bulk.bulkExport(effective, format);
    },
    [sidebarSel.selected, tours.tree, bulk],
  );

  const handleOpenInKomoot = useCallback(() => {
    for (const item of sidebarSel.selected.values()) {
      if (item.type === 'tour' && item.tourId != null) {
        window.open(komootTourUrl(item.tourId), '_blank');
      } else if (item.type === 'folder') {
        const node = tours.tree ? findNode(tours.tree, item.path) : null;
        const folderTours = node ? collectTours(node) : [];
        const folderName = item.path
          ? item.path.split('/').pop()!
          : 'All Tours';
        window.open(komootFolderUrl(folderName, folderTours), '_blank');
      }
    }
  }, [sidebarSel.selected, tours.tree]);

  const handleRefreshDetail = useCallback(
    async (tour: Tour, folderContext: FolderContext | null) => {
      await sel.refreshDetail(tour, folderContext);
    },
    [sel],
  );

  const requestDeleteTours = useCallback((toursToDelete: Tour[]) => {
    setDeleteTargetTours(toursToDelete);
  }, []);

  const requestRenameTour = useCallback(
    (tour: Tour) => {
      if (!isOwnTour(tour, Api.userId)) {
        setFallbackRenameTour(tour);
        return;
      }
      const item = sidebarSel.flatItems.find(
        (fi) => fi.type === 'tour' && fi.tour?.id === tour.id,
      );
      if (item) {
        sidebarSel.startRenameFor(item);
      } else {
        setFallbackRenameTour(tour);
      }
    },
    [sidebarSel],
  );

  const ctx: AppContextValue = {
    userId: Api.userId,
    auth,
    tours,
    sel,
    customNameHook,
    rename,
    upload,
    sidebarSel,
    bulk,
    dragDrop,
    lastExportFormat,
    setLastExportFormat,
    handlePatchTour,
    handleActivateItem,
    handleInlineRename,
    handleFolderRename,
    handleBulkDelete,
    handleBulkExport,
    handleOpenInKomoot,
    handleRefreshDetail,
    requestDeleteTours,
    requestRenameTour,
  };

  return (
    <AppContext.Provider value={ctx}>
      {children}
      <DialogHost
        deleteTargetTours={deleteTargetTours}
        clearDeleteTargets={() => setDeleteTargetTours([])}
        fallbackRenameTour={fallbackRenameTour}
        clearFallbackRename={() => setFallbackRenameTour(null)}
      />
    </AppContext.Provider>
  );
}

/* ── Dialog host ──────────────────────────────────────────────────────── */

interface DialogHostProps {
  deleteTargetTours: Tour[];
  clearDeleteTargets: () => void;
  fallbackRenameTour: Tour | null;
  clearFallbackRename: () => void;
}

function DialogHost({
  deleteTargetTours,
  clearDeleteTargets,
  fallbackRenameTour,
  clearFallbackRename,
}: DialogHostProps) {
  const { sel, bulk, upload, customNameHook, sidebarSel, rename } =
    useContext(AppContext);

  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const showDeleteDialog = deleteTargetTours.length > 0;

  const handleConfirmDelete = useCallback(() => {
    const toursToDelete = [...deleteTargetTours];
    clearDeleteTargets();
    bulk.bulkDelete(sidebarSel.selected, () => {
      sidebarSel.clearSelection();
      if (
        sel.detailTour &&
        toursToDelete.some((t) => t.id === sel.detailTour!.id)
      ) {
        sel.clearDetail();
      }
    });
  }, [bulk, sidebarSel, sel, deleteTargetTours, clearDeleteTargets]);

  const handleFallbackRenameSave = useCallback(
    async (newName: string) => {
      if (!fallbackRenameTour) return;
      await rename.handleInlineRename(fallbackRenameTour, newName);
      clearFallbackRename();
    },
    [fallbackRenameTour, rename, clearFallbackRename],
  );

  const handleImportMappings = useCallback(
    async (file: File) => customNameHook.importMappings(file),
    [customNameHook],
  );

  const deleteStats =
    deleteTargetTours.length > 1
      ? {
          tourCount: deleteTargetTours.length,
          totalDistance: deleteTargetTours.reduce((s, t) => s + t.distance, 0),
          totalDuration: deleteTargetTours.reduce((s, t) => s + t.duration, 0),
          confirmText: 'delete',
        }
      : undefined;

  // Listen for the mapping dialog trigger event from Sidebar
  useEffect(() => {
    const handler = () => setShowMappingDialog(true);
    window.addEventListener('open-mapping-dialog', handler);
    return () => window.removeEventListener('open-mapping-dialog', handler);
  }, []);

  return (
    <>
      {showDeleteDialog && (
        <ConfirmDialog
          title={
            deleteTargetTours.length === 1
              ? '🗑️ Delete Tour'
              : `🗑️ Delete ${deleteTargetTours.length} Tours`
          }
          message={
            deleteTargetTours.length === 1
              ? `Are you sure you want to delete "${deleteTargetTours[0]?.name || 'Unnamed'}"?`
              : `Are you sure you want to delete ${deleteTargetTours.length} tours?`
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={handleConfirmDelete}
          onCancel={clearDeleteTargets}
          bulkInfo={deleteStats}
        />
      )}
      {fallbackRenameTour && (
        <FallbackRenameDialog
          tour={fallbackRenameTour}
          customNames={customNameHook.customNames}
          onSave={handleFallbackRenameSave}
          onCancel={clearFallbackRename}
        />
      )}
      {bulk.progress && (
        <BulkProgressDialog
          progress={bulk.progress}
          onCancel={bulk.cancelOperation}
        />
      )}
      {upload.showUpload && (
        <UploadDialog
          uploading={upload.uploading}
          error={upload.uploadError}
          onUpload={upload.handleUpload}
          onClose={() => upload.setShowUpload(false)}
        />
      )}
      {showMappingDialog && (
        <MappingDialog
          records={customNameHook.records}
          isDirty={customNameHook.isDirty}
          onExport={customNameHook.exportMappings}
          onImport={handleImportMappings}
          onDelete={customNameHook.deleteMapping}
          onClose={() => setShowMappingDialog(false)}
        />
      )}
      <ToastContainer toasts={bulk.toasts} onDismiss={bulk.dismissToast} />
    </>
  );
}
