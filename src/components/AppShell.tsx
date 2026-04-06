import { useCallback, useState } from 'preact/hooks';

import { useAppContext } from '../contexts/useAppContext.ts';

import { LoadingOverlay } from './LoadingOverlay/LoadingOverlay.tsx';
import { LoginScreen } from './LoginScreen/LoginScreen.tsx';
import { AppHeader } from './AppHeader/AppHeader.tsx';
import { Sidebar } from './Sidebar/Sidebar.tsx';
import { MapView } from './MapView/MapView.tsx';
import { DetailPanel } from './DetailPanel/DetailPanel.tsx';
import styles from './AppShell.module.css';

export function AppShell() {
  const { auth, tours, sel, bulk, upload } = useAppContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoading = tours.loading || sel.loading;
  const loadingText = sel.loading ? sel.loadingText : 'Loading tours…';

  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);

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
      <LoadingOverlay
        visible={isLoading && !bulk.progress}
        text={loadingText}
      />
      <div class={styles.shell}>
        <AppHeader
          displayName={auth.displayName}
          onLogout={() => {
            sel.reset();
            auth.handleLogout();
          }}
          onUpload={() => upload.setShowUpload(true)}
          onToggleSidebar={() => setSidebarOpen((p) => !p)}
        />
        <div class={styles.body}>
          <div
            class={`${styles.sidebarOverlay} ${sidebarOpen ? styles.sidebarOverlayVisible : ''}`}
            onClick={handleCloseSidebar}
          />
          <div
            class={`${styles.sidebarWrap} ${sidebarOpen ? styles.sidebarOpen : ''}`}
          >
            <Sidebar onNavigate={handleCloseSidebar} />
          </div>
          <div class={styles.main}>
            <MapView tracks={sel.tracks} onTrackClick={sel.handleTrackClick} />
            <DetailPanel />
          </div>
        </div>
      </div>
      {tours.error && <div class={styles.errorBanner}>{tours.error}</div>}
    </>
  );
}
