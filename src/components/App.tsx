import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import type {
  Coordinate,
  FolderContext,
  Selection,
  Tour,
  TrackEntry,
  TreeNode,
} from '../types.ts';

import { CONFIG } from '../config.ts';
import { Api, AuthExpiredError } from '../logic/api.ts';
import { buildTree, collectTours, findNode } from '../logic/tree.ts';
import { LoadingOverlay } from './LoadingOverlay/LoadingOverlay.tsx';
import { LoginScreen } from './LoginScreen/LoginScreen.tsx';
import { AppHeader } from './AppHeader/AppHeader.tsx';
import { Sidebar } from './Sidebar/Sidebar.tsx';
import { MapView } from './MapView/MapView.tsx';
import { DetailPanel } from './DetailPanel/DetailPanel.tsx';
import { RenameDialog } from './RenameDialog/RenameDialog.tsx';

export function App() {
  // Auth
  const [authenticated, setAuthenticated] = useState(() => Api.restoreAuth());
  const [loginError, setLoginError] = useState('');

  // Data
  const [allTours, setAllTours] = useState<Tour[]>([]);
  const [filteredTours, setFilteredTours] = useState<Tour[]>([]);
  const [tree, setTree] = useState<TreeNode | null>(null);

  // UI
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading…');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [openPaths, setOpenPaths] = useState<Set<string>>(() => new Set(['']));
  const [tracks, setTracks] = useState<TrackEntry[]>([]);
  const [renamingTour, setRenamingTour] = useState<Tour | null>(null);

  // Detail panel state
  const [detailTour, setDetailTour] = useState<Tour | null>(null);
  const [detailCoords, setDetailCoords] = useState<Coordinate[] | null>(null);
  const [detailFolderContext, setDetailFolderContext] =
    useState<FolderContext | null>(null);
  const [folderTours, setFolderTours] = useState<Tour[]>([]);

  const filterRef = useRef('');

  const handleAuthError = useCallback(() => {
    Api.clearAuth();
    Api.resetCaches();
    setAuthenticated(false);
    setLoginError('Session expired. Please sign in again.');
  }, []);

  // --- Login / Logout ---

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      setLoginError('');
      try {
        await Api.login(email, password);
        setAuthenticated(true);
      } catch (e) {
        setLoginError(e instanceof Error ? e.message : String(e));
      }
    },
    [],
  );

  const handleLogout = useCallback(() => {
    Api.clearAuth();
    Api.resetCaches();
    setAllTours([]);
    setFilteredTours([]);
    setTree(null);
    setSelection(null);
    setTracks([]);
    setDetailTour(null);
    setDetailCoords(null);
    setDetailFolderContext(null);
    setFolderTours([]);
    setAuthenticated(false);
    setLoginError('');
    setOpenPaths(new Set(['']));
  }, []);

  // --- Load tours on auth ---

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadingText('Loading tours…');
      try {
        const tours = await Api.fetchAllTours();
        if (cancelled) return;
        setAllTours(tours);
        setFilteredTours(tours);
      } catch (e) {
        if (e instanceof AuthExpiredError) handleAuthError();
        else console.error('Failed to load tours:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [authenticated, handleAuthError]);

  // --- Rebuild tree when filteredTours change ---

  useEffect(() => {
    setTree(buildTree(filteredTours));
  }, [filteredTours]);

  // --- Filter ---

  const handleFilter = useCallback(
    (query: string) => {
      filterRef.current = query;
      const q = query.toLowerCase().trim();
      const newFiltered = q
        ? allTours.filter((t) => (t.name || '').toLowerCase().includes(q))
        : allTours;
      setFilteredTours(newFiltered);
    },
    [allTours],
  );

  // --- Map helpers ---

  const loadTracksForTours = useCallback(
    async (tours: Tour[]) => {
      const withPts = tours.filter((t) => t.start_point);
      if (!withPts.length) {
        setTracks([]);
        return;
      }

      setLoading(true);
      setLoadingText('Loading tracks…');
      try {
        const toLoad = withPts.slice(0, CONFIG.MAX_TRACKS_FULL_LOAD);
        const results = await Promise.allSettled(
          toLoad.map((t) => Api.fetchCoordinates(t.id)),
        );
        const newTracks: TrackEntry[] = [];

        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const t = toLoad[i];
          const c = CONFIG.COLORS[i % CONFIG.COLORS.length];
          if (r.status === 'fulfilled' && r.value && r.value.length > 0) {
            newTracks.push({ coords: r.value, color: c, name: t.name });
          } else if (t.start_point) {
            newTracks.push({
              coords: [{ lat: t.start_point.lat, lng: t.start_point.lng }],
              color: c,
              name: t.name,
            });
          }
        }

        // Remaining tours: show only start points
        for (let i = CONFIG.MAX_TRACKS_FULL_LOAD; i < withPts.length; i++) {
          const t = withPts[i];
          const c = CONFIG.COLORS[i % CONFIG.COLORS.length];
          if (t.start_point) {
            newTracks.push({
              coords: [{ lat: t.start_point.lat, lng: t.start_point.lng }],
              color: c,
              name: t.name,
            });
          }
        }

        setTracks(newTracks);
      } catch (e) {
        if (e instanceof AuthExpiredError) handleAuthError();
      } finally {
        setLoading(false);
      }
    },
    [handleAuthError],
  );

  // --- Selection handlers ---

  const handleSelectFolder = useCallback(
    async (path: string) => {
      setSelection({ type: 'folder', path });
      setDetailTour(null);
      setDetailCoords(null);
      setDetailFolderContext(null);

      if (!tree) return;
      const node = findNode(tree, path);
      if (!node) return;
      const tours = collectTours(node);
      setFolderTours(tours);
      await loadTracksForTours(tours);
    },
    [tree, loadTracksForTours],
  );

  const showTourDetail = useCallback(
    async (tour: Tour, folderCtx: FolderContext | null) => {
      setLoading(true);
      setLoadingText('Loading track…');
      try {
        const coords = await Api.fetchCoordinates(tour.id);
        setDetailTour(tour);
        setDetailCoords(coords);
        setDetailFolderContext(folderCtx);

        if (coords && coords.length > 0) {
          setTracks([{ coords, color: CONFIG.COLORS[0], name: tour.name }]);
        } else if (tour.start_point) {
          setTracks([
            {
              coords: [{ lat: tour.start_point.lat, lng: tour.start_point.lng }],
              color: CONFIG.COLORS[0],
              name: tour.name,
            },
          ]);
        }
      } catch (e) {
        if (e instanceof AuthExpiredError) handleAuthError();
        else console.warn('Detail load failed:', e);
      } finally {
        setLoading(false);
      }
    },
    [handleAuthError],
  );

  const handleSelectTourFromList = useCallback(
    async (tour: Tour) => {
      // Derive folder context from current selection
      let folderCtx: FolderContext | null = null;
      if (selection?.type === 'folder' && tree) {
        const node = findNode(tree, selection.path);
        folderCtx = {
          path: selection.path,
          tours: node ? collectTours(node) : [],
        };
      } else if (selection?.type === 'tour' && selection.folderContext) {
        folderCtx = selection.folderContext;
      }

      setSelection({ type: 'tour', tourId: tour.id, folderContext: folderCtx });
      await showTourDetail(tour, folderCtx);
    },
    [selection, tree, showTourDetail],
  );

  const handleSelectTourFromTree = useCallback(
    async (tour: Tour) => {
      setSelection({ type: 'tour', tourId: tour.id, folderContext: null });
      await showTourDetail(tour, null);
    },
    [showTourDetail],
  );

  const handleTogglePath = useCallback((path: string) => {
    setOpenPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // --- Rename ---

  const handleRenameSave = useCallback(
    async (newName: string) => {
      if (!renamingTour) return;
      await Api.renameTour(renamingTour.id, newName);

      // Update local data
      setAllTours((prev) =>
        prev.map((t) => (t.id === renamingTour.id ? { ...t, name: newName } : t)),
      );

      // Re-apply filter
      const q = filterRef.current.toLowerCase().trim();
      setFilteredTours((prev) => {
        const updated = prev.map((t) =>
          t.id === renamingTour.id ? { ...t, name: newName } : t,
        );
        return q ? updated.filter((t) => (t.name || '').toLowerCase().includes(q)) : updated;
      });

      // Update detail view if showing this tour
      if (detailTour?.id === renamingTour.id) {
        setDetailTour((prev) => (prev ? { ...prev, name: newName } : prev));
      }

      setRenamingTour(null);
    },
    [renamingTour, detailTour],
  );

  // --- Render ---

  if (!authenticated) {
    return (
      <>
        <LoadingOverlay visible={loading} text={loadingText} />
        <LoginScreen error={loginError} onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      <LoadingOverlay visible={loading} text={loadingText} />
      <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
        <AppHeader displayName={Api.displayName} onLogout={handleLogout} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar
            tree={tree}
            tourCount={filteredTours.length}
            selection={selection}
            openPaths={openPaths}
            onFilter={handleFilter}
            onSelectFolder={handleSelectFolder}
            onSelectTour={handleSelectTourFromTree}
            onTogglePath={handleTogglePath}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <MapView tracks={tracks} />
            <DetailPanel
              selection={selection}
              folderPath={selection?.type === 'folder' ? selection.path : undefined}
              folderTours={selection?.type === 'folder' ? folderTours : undefined}
              tour={selection?.type === 'tour' ? detailTour : undefined}
              coords={selection?.type === 'tour' ? detailCoords : undefined}
              folderContext={
                selection?.type === 'tour' ? detailFolderContext : undefined
              }
              onSelectFolder={handleSelectFolder}
              onSelectTour={handleSelectTourFromList}
              onRename={setRenamingTour}
            />
          </div>
        </div>
      </div>
      <RenameDialog
        tour={renamingTour}
        onSave={handleRenameSave}
        onClose={() => setRenamingTour(null)}
      />
    </>
  );
}
