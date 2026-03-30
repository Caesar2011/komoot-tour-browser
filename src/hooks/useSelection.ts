import { useCallback, useRef, useState } from 'preact/hooks';

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
import { collectTours, findNode } from '../logic/tree.ts';
import { buildPointEntry } from '../logic/tracks.ts';

export function useSelection(
  tree: TreeNode | null,
  allTours: Tour[],
  onAuthError: () => void,
) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [openPaths, setOpenPaths] = useState<Set<string>>(() => new Set(['']));
  const [tracks, setTracks] = useState<TrackEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading…');

  const [detailTour, setDetailTour] = useState<Tour | null>(null);
  const [detailCoords, setDetailCoords] = useState<Coordinate[] | null>(null);
  const [detailFolderContext, setDetailFolderContext] =
    useState<FolderContext | null>(null);
  const [folderTours, setFolderTours] = useState<Tour[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const currentFolderToursRef = useRef<Tour[]>([]);

  const abortPending = () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
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
            newTracks.push({
              tourId: t.id,
              coords: r.value,
              color: c,
              name: t.name,
            });
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
        if (e instanceof AuthExpiredError) onAuthError();
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [onAuthError],
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
          setTracks([
            {
              tourId: tour.id,
              coords,
              color: CONFIG.COLORS[0],
              name: tour.name,
            },
          ]);
        } else if (tour.start_point) {
          setTracks([
            {
              tourId: tour.id,
              coords: [
                { lat: tour.start_point.lat, lng: tour.start_point.lng },
              ],
              color: CONFIG.COLORS[0],
              name: tour.name,
            },
          ]);
        }
      } catch (e) {
        if (e instanceof AuthExpiredError) onAuthError();
        else if (!(e instanceof DOMException && e.name === 'AbortError')) {
          // Silently ignore non-abort fetch failures for detail view
        }
      } finally {
        if (!signal.aborted && !isCached) setLoading(false);
      }
    },
    [onAuthError],
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

  const updateDetailTourName = useCallback(
    (tourId: number, newName: string) => {
      setDetailTour((prev) =>
        prev && prev.id === tourId ? { ...prev, name: newName } : prev,
      );
    },
    [],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSelection(null);
    setTracks([]);
    setDetailTour(null);
    setDetailCoords(null);
    setDetailFolderContext(null);
    setFolderTours([]);
    setOpenPaths(new Set(['']));
  }, []);

  return {
    selection,
    openPaths,
    tracks,
    loading,
    loadingText,
    detailTour,
    detailCoords,
    detailFolderContext,
    folderTours,
    handleSelectFolder,
    handleSelectTourFromList,
    handleSelectTourFromTree,
    handleTrackClick,
    handleTogglePath,
    updateDetailTourName,
    reset,
  } as const;
}
