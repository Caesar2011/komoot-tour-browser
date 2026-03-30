import { useCallback } from 'preact/hooks';

import type { Tour, TourStatus } from '../types.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useTours } from '../hooks/useTours.ts';
import { useSelection } from '../hooks/useSelection.ts';
import { useRename } from '../hooks/useRename.ts';
import { useUpload } from '../hooks/useUpload.ts';
import { Api, ForbiddenError } from '../logic/api.ts';

import { LoadingOverlay } from './LoadingOverlay/LoadingOverlay.tsx';
import { LoginScreen } from './LoginScreen/LoginScreen.tsx';
import { AppHeader } from './AppHeader/AppHeader.tsx';
import { Sidebar } from './Sidebar/Sidebar.tsx';
import { MapView } from './MapView/MapView.tsx';
import { DetailPanel } from './DetailPanel/DetailPanel.tsx';
import { RenameDialog } from './RenameDialog/RenameDialog.tsx';
import { UploadDialog } from './UploadDialog/UploadDialog.tsx';

export function App() {
  const auth = useAuth();
  const tours = useTours(auth.authenticated, auth.handleAuthError);
  const sel = useSelection(tours.tree, tours.allTours, auth.handleAuthError);
  const rename = useRename(tours.applyTourUpdate, sel.updateDetailTour);
  const upload = useUpload(tours.addTour);

  const handleLogout = useCallback(() => {
    sel.reset();
    auth.handleLogout();
  }, [sel, auth]);

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
        if (e instanceof ForbiddenError) {
          throw e;
        }
        throw e;
      }
    },
    [tours, sel],
  );

  const handleDownloadGpx = useCallback(
    async (tourId: number, tourName: string) => {
      const { triggerDownload } = await import('../logic/utils.ts');
      const blob = await Api.downloadGpx(tourId);
      const safeName = (tourName || 'tour').replace(/[^a-zA-Z0-9_-]/g, '_');
      triggerDownload(blob, `${safeName}.gpx`);
    },
    [],
  );

  const handleDownloadFit = useCallback(
    async (tourId: number, tourName: string) => {
      const { triggerDownload } = await import('../logic/utils.ts');
      const blob = await Api.downloadFit(tourId);
      const safeName = (tourName || 'tour').replace(/[^a-zA-Z0-9_-]/g, '_');
      triggerDownload(blob, `${safeName}.fit`);
    },
    [],
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

  return (
    <>
      <LoadingOverlay visible={isLoading} text={loadingText} />
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
            selection={sel.selection}
            openPaths={sel.openPaths}
            filters={tours.filters}
            onFilter={tours.handleFilter}
            onFiltersChange={tours.handleServerFiltersChange}
            onSelectFolder={sel.handleSelectFolder}
            onSelectTour={sel.handleSelectTourFromTree}
            onTogglePath={sel.handleTogglePath}
            onInlineRename={rename.handleInlineRename}
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
              onRename={rename.setRenamingTour}
              onPatchTour={handlePatchTour}
              onDownloadGpx={handleDownloadGpx}
              onDownloadFit={handleDownloadFit}
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
      <RenameDialog
        tour={rename.renamingTour}
        onSave={rename.handleRenameSave}
        onClose={() => rename.setRenamingTour(null)}
      />
      {upload.showUpload && (
        <UploadDialog
          uploading={upload.uploading}
          error={upload.uploadError}
          onUpload={upload.handleUpload}
          onClose={() => upload.setShowUpload(false)}
        />
      )}
    </>
  );
}
