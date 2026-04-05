import { useCallback, useState } from 'preact/hooks';

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

import { LoadingOverlay } from './LoadingOverlay/LoadingOverlay.tsx';
import { LoginScreen } from './LoginScreen/LoginScreen.tsx';
import { AppHeader } from './AppHeader/AppHeader.tsx';
import { Sidebar } from './Sidebar/Sidebar.tsx';
import { MapView } from './MapView/MapView.tsx';
import { DetailPanel } from './DetailPanel/DetailPanel.tsx';
import { UploadDialog } from './UploadDialog/UploadDialog.tsx';
import { ConfirmDialog } from './ConfirmDialog/ConfirmDialog.tsx';
import { BulkProgressDialog } from './BulkProgressDialog/BulkProgressDialog.tsx';
import { ToastContainer } from './ToastContainer/ToastContainer.tsx';
import { MappingDialog } from './MappingDialog/MappingDialog.tsx';
import { FallbackRenameDialog } from './FallbackRenameDialog/FallbackRenameDialog.tsx';

export function App() {
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetTours, setDeleteTargetTours] = useState<Tour[]>([]);
  const [fallbackRenameTour, setFallbackRenameTour] = useState<Tour | null>(
    null,
  );
  const [showMappingDialog, setShowMappingDialog] = useState(false);

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

  const handleLogout = useCallback(() => {
    sel.reset();
    sidebarSel.clearSelection();
    auth.handleLogout();
  }, [sel, sidebarSel, auth]);

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

  const handleBulkDelete = useCallback(() => {
    const effectiveTours = resolveEffectiveTours(
      sidebarSel.selected,
      tours.tree,
    );
    if (effectiveTours.length === 0) return;
    setDeleteTargetTours(effectiveTours);
    setShowDeleteDialog(true);
  }, [sidebarSel.selected, tours.tree]);

  const handleConfirmDelete = useCallback(() => {
    setShowDeleteDialog(false);
    const toursToDelete = [...deleteTargetTours];
    bulk.bulkDelete(sidebarSel.selected, () => {
      sidebarSel.clearSelection();
      if (sel.detailTour) {
        const deleted = toursToDelete.some((t) => t.id === sel.detailTour!.id);
        if (deleted) sel.clearDetail();
      }
    });
  }, [bulk, sidebarSel, sel, deleteTargetTours]);

  const handleBulkExport = useCallback(
    (format: ExportFormat) => {
      const effectiveTours = resolveEffectiveTours(
        sidebarSel.selected,
        tours.tree,
      );
      bulk.bulkExport(effectiveTours, format);
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

  const handleDeleteTourFromDetail = useCallback((tour: Tour) => {
    setDeleteTargetTours([tour]);
    setShowDeleteDialog(true);
  }, []);

  const handleRenameFromDetail = useCallback(
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

  const handleFallbackRenameSave = useCallback(
    async (newName: string) => {
      if (!fallbackRenameTour) return;
      try {
        await rename.handleInlineRename(fallbackRenameTour, newName);
      } catch {
        // ignore
      }
      setFallbackRenameTour(null);
    },
    [fallbackRenameTour, rename],
  );

  const handleRefreshDetail = useCallback(
    async (tour: Tour, folderContext: FolderContext | null) => {
      await sel.refreshDetail(tour, folderContext);
    },
    [sel],
  );

  const handleImportMappings = useCallback(
    async (file: File) => {
      return customNameHook.importMappings(file);
    },
    [customNameHook],
  );

  const isLoading = tours.loading || sel.loading;
  const loadingText = sel.loading ? sel.loadingText : 'Loading tours…';

  if (!auth.authenticated) {
    return (
      <>
        <LoadingOverlay visible={isLoading} text={loadingText} />
        <LoginScreen error={auth.loginError} onLogin={auth.handleLogin} />
      </>
    );
  }

  const deleteStats =
    deleteTargetTours.length > 0
      ? {
          tourCount: deleteTargetTours.length,
          totalDistance: deleteTargetTours.reduce((s, t) => s + t.distance, 0),
          totalDuration: deleteTargetTours.reduce((s, t) => s + t.duration, 0),
          confirmText: 'delete',
        }
      : undefined;

  return (
    <>
      <LoadingOverlay
        visible={isLoading && !bulk.progress}
        text={loadingText}
      />
      <div
        style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}
      >
        <AppHeader
          displayName={auth.displayName}
          onLogout={handleLogout}
          onUpload={() => upload.setShowUpload(true)}
        />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar
            tree={tours.tree}
            tourCount={tours.filteredTours.length}
            toursLoading={tours.loading}
            filters={tours.filters}
            allTours={tours.allTours}
            onFiltersChange={tours.handleFiltersChange}
            onTogglePath={sel.handleTogglePath}
            onOpenPath={sel.openPath}
            onClosePath={sel.closePath}
            openPaths={sel.openPaths}
            sidebarSel={sidebarSel}
            dragDrop={dragDrop}
            onActivateItem={handleActivateItem}
            onBulkDelete={handleBulkDelete}
            onBulkExport={handleBulkExport}
            onOpenInKomoot={handleOpenInKomoot}
            onInlineRename={handleInlineRename}
            onFolderRename={handleFolderRename}
            onRefreshTours={tours.refreshTours}
            lastExportFormat={lastExportFormat}
            onSetExportFormat={setLastExportFormat}
            customNames={customNameHook.customNames}
            isDirtyMappings={customNameHook.isDirty}
            onOpenMappingDialog={() => setShowMappingDialog(true)}
          />
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <MapView tracks={sel.tracks} onTrackClick={sel.handleTrackClick} />
            <DetailPanel
              selection={sel.selection}
              folderTours={sel.folderTours}
              tour={sel.detailTour}
              coords={sel.detailCoords}
              folderContext={sel.detailFolderContext}
              timeline={sel.detailTimeline}
              coverImages={sel.detailCoverImages}
              wayTypes={sel.detailWayTypes}
              surfaces={sel.detailSurfaces}
              onSelectFolder={sel.handleSelectFolder}
              onSelectTour={sel.handleSelectTourFromList}
              onRename={handleRenameFromDetail}
              onPatchTour={handlePatchTour}
              onDeleteTour={handleDeleteTourFromDetail}
              onRefresh={handleRefreshDetail}
              lastExportFormat={lastExportFormat}
              onSetExportFormat={setLastExportFormat}
              customNames={customNameHook.customNames}
            />
          </div>
        </div>
      </div>
      {tours.error && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px 20px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 10000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {tours.error}
        </div>
      )}
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
          onCancel={() => setShowDeleteDialog(false)}
          bulkInfo={deleteTargetTours.length > 1 ? deleteStats : undefined}
        />
      )}
      {fallbackRenameTour && (
        <FallbackRenameDialog
          tour={fallbackRenameTour}
          customNames={customNameHook.customNames}
          onSave={handleFallbackRenameSave}
          onCancel={() => setFallbackRenameTour(null)}
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
