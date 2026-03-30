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
  const [authenticated, setAuthenticated] = useState(() => Api.restoreAuth());
  const [loginError, setLoginError] = useState('');

  const [allTours, setAllTours] = useState<Tour[]>([]);
  const [filteredTours, setFilteredTours] = useState<Tour[]>([]);
  const [tree, setTree] = useState<TreeNode | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading…');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [openPaths, setOpenPaths] = useState<Set<string>>(() => new Set(['']));
  const [tracks, setTracks] = useState<TrackEntry[]>([]);
  const [renamingTour, setRenamingTour] = useState<Tour | null>(null);

  const [detailTour, setDetailTour] = useState<Tour | null>(null);
  const [detailCoords, setDetailCoords] = useState<Coordinate[] | null>(null);
  const [detailFolderContext, setDetailFolderContext] =
    useState<FolderContext | null>(null);
  const [folderTours, setFolderTours] = useState<Tour[]>([]);

  const filterRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  const currentFolderToursRef = useRef<Tour[]>([]);

  const abortPending = () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };

  const handleAuthError = useCallback(() => {
    Api.clearAuth();
    Api.resetCaches();
    setAuthenticated(false);
    setLoginError('Session expired. Please sign in again.');
  }, []);

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
    abortRef.current?.abort();
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

  useEffect(() => {
    setTree(buildTree(filteredTours));
  }, [filteredTours]);

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

  const buildPointEntry = (tour: Tour, colorIdx: number): TrackEntry | null => {
    const color = CONFIG.COLORS[colorIdx % CONFIG.COLORS.length];
    const cached = Api.getCachedCoordinates(tour.id);
    if (cached && cached.length > 0) {
      return { tourId: tour.id, coords: cached, color, name: tour.name };
    }
    if (tour.start_point) {
      return {
        tourId: tour.id,
        coords: [{ lat: tour.start_point.lat, lng: tour.start_point.lng }],
        color,
        name: tour.name,
      };
    }
    return null;
  };

  const loadTracksForTours = useCallback(
    async (tours: Tour[]) => {
      const signal = abortPending();
      currentFolderToursRef.current = tours;
      const withPts = tours.filter((t) => t.start_point);
      if (!withPts.length) {
        setTracks([]);
        return;
      }

      setLoading(true);
      setLoadingText('Loading tracks…');
      try {
        const eagerBatch = withPts.slice(0, CONFIG.TRACKS_EAGER_LIMIT);
        const results = await Promise.allSettled(
          eagerBatch.map((t) => Api.fetchCoordinates(t.id, signal)),
        );
        if (signal.aborted) return;

        const newTracks: TrackEntry[] = [];

        for (let i = 0; i < eagerBatch.length; i++) {
          const r = results[i];
          const t = eagerBatch[i];
          const c = CONFIG.COLORS[i % CONFIG.COLORS.length];
          if (r.status === 'fulfilled' && r.value && r.value.length > 0) {
            newTracks.push({ tourId: t.id, coords: r.value, color: c, name: t.name });
          } else if (t.start_point) {
            newTracks.push({
              tourId: t.id,
              coords: [{ lat: t.start_point.lat, lng: t.start_point.lng }],
              color: c,
              name: t.name,
            });
          }
        }

        for (let i = CONFIG.TRACKS_EAGER_LIMIT; i < withPts.length; i++) {
          const entry = buildPointEntry(withPts[i], i);
          if (entry) newTracks.push(entry);
        }

        setTracks(newTracks);
      } catch (e) {
        if (e instanceof AuthExpiredError) handleAuthError();
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [handleAuthError],
  );

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
      const signal = abortPending();
      const isCached = Api.hasCachedCoordinates(tour.id);

      if (!isCached) {
        setLoading(true);
        setLoadingText('Loading track…');
      }
      try {
        const coords = await Api.fetchCoordinates(tour.id, signal);
        if (signal.aborted) return;

        setDetailTour(tour);
        setDetailCoords(coords);
        setDetailFolderContext(folderCtx);

        if (coords && coords.length > 0) {
          setTracks([{ tourId: tour.id, coords, color: CONFIG.COLORS[0], name: tour.name }]);
        } else if (tour.start_point) {
          setTracks([
            {
              tourId: tour.id,
              coords: [{ lat: tour.start_point.lat, lng: tour.start_point.lng }],
              color: CONFIG.COLORS[0],
              name: tour.name,
            },
          ]);
        }
      } catch (e) {
        if (e instanceof AuthExpiredError) handleAuthError();
        else if (!(e instanceof DOMException && e.name === 'AbortError')) {
          console.warn('Detail load failed:', e);
        }
      } finally {
        if (!signal.aborted && !isCached) setLoading(false);
      }
    },
    [handleAuthError],
  );

  const deriveFolderContext = useCallback((): FolderContext | null => {
    if (selection?.type === 'folder' && tree) {
      const node = findNode(tree, selection.path);
      return { path: selection.path, tours: node ? collectTours(node) : [] };
    }
    if (selection?.type === 'tour' && selection.folderContext) {
      return selection.folderContext;
    }
    return null;
  }, [selection, tree]);

  const handleSelectTourFromList = useCallback(
    async (tour: Tour) => {
      const folderCtx = deriveFolderContext();
      setSelection({ type: 'tour', tourId: tour.id, folderContext: folderCtx });
      await showTourDetail(tour, folderCtx);
    },
    [deriveFolderContext, showTourDetail],
  );

  const handleSelectTourFromTree = useCallback(
    async (tour: Tour) => {
      setSelection({ type: 'tour', tourId: tour.id, folderContext: null });
      await showTourDetail(tour, null);
    },
    [showTourDetail],
  );

  const handleTrackClick = useCallback(
    (tourId: number) => {
      const tour =
        currentFolderToursRef.current.find((t) => t.id === tourId) ??
        allTours.find((t) => t.id === tourId);
      if (!tour) return;

      const folderCtx = deriveFolderContext();
      setSelection({ type: 'tour', tourId: tour.id, folderContext: folderCtx });
      showTourDetail(tour, folderCtx);
    },
    [allTours, deriveFolderContext, showTourDetail],
  );

  const handleTogglePath = useCallback((path: string) => {
    setOpenPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const applyRenameToState = useCallback(
    (tourId: number, newName: string) => {
      setAllTours((prev) =>
        prev.map((t) => (t.id === tourId ? { ...t, name: newName } : t)),
      );

      const q = filterRef.current.toLowerCase().trim();
      setFilteredTours((prev) => {
        const updated = prev.map((t) =>
          t.id === tourId ? { ...t, name: newName } : t,
        );
        return q ? updated.filter((t) => (t.name || '').toLowerCase().includes(q)) : updated;
      });

      if (detailTour?.id === tourId) {
        setDetailTour((prev) => (prev ? { ...prev, name: newName } : prev));
      }
    },
    [detailTour],
  );

  const handleInlineRename = useCallback(
    async (tour: Tour, newName: string) => {
      await Api.renameTour(tour.id, newName);
      applyRenameToState(tour.id, newName);
    },
    [applyRenameToState],
  );

  const handleRenameSave = useCallback(
    async (newName: string) => {
      if (!renamingTour) return;
      await Api.renameTour(renamingTour.id, newName);
      applyRenameToState(renamingTour.id, newName);
      setRenamingTour(null);
    },
    [renamingTour, applyRenameToState],
  );

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
            onInlineRename={handleInlineRename}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <MapView tracks={tracks} onTrackClick={handleTrackClick} />
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
