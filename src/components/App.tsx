import { useCallback } from 'preact/hooks';

import { useAuth } from '../hooks/useAuth.ts';
import { useTours } from '../hooks/useTours.ts';
import { useSelection } from '../hooks/useSelection.ts';
import { useRename } from '../hooks/useRename.ts';

import { LoadingOverlay } from './LoadingOverlay/LoadingOverlay.tsx';
import { LoginScreen } from './LoginScreen/LoginScreen.tsx';
import { AppHeader } from './AppHeader/AppHeader.tsx';
import { Sidebar } from './Sidebar/Sidebar.tsx';
import { MapView } from './MapView/MapView.tsx';
import { DetailPanel } from './DetailPanel/DetailPanel.tsx';
import { RenameDialog } from './RenameDialog/RenameDialog.tsx';

export function App() {
  const auth = useAuth();

  const tours = useTours(auth.authenticated, auth.handleAuthError);

  const sel = useSelection(tours.tree, tours.allTours, auth.handleAuthError);

  const rename = useRename(tours.applyRenameToState, sel.updateDetailTourName);

  const handleLogout = useCallback(() => {
    sel.reset();
    auth.handleLogout();
  }, [sel, auth]);

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
        <AppHeader displayName={auth.displayName} onLogout={handleLogout} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar
            tree={tours.tree}
            tourCount={tours.filteredTours.length}
            selection={sel.selection}
            openPaths={sel.openPaths}
            onFilter={tours.handleFilter}
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
              onSelectFolder={sel.handleSelectFolder}
              onSelectTour={sel.handleSelectTourFromList}
              onRename={rename.setRenamingTour}
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
    </>
  );
}
