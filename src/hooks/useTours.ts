import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import type { ServerFilters, Tour, TreeNode } from '../types.ts';
import { DEFAULT_FILTERS } from '../types.ts';
import { Api, AuthExpiredError } from '../logic/api.ts';
import { buildTree } from '../logic/tree.ts';

export function useTours(authenticated: boolean, onAuthError: () => void) {
  const [allTours, setAllTours] = useState<Tour[]>([]);
  const [filteredTours, setFilteredTours] = useState<Tour[]>([]);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ServerFilters>(DEFAULT_FILTERS);

  const filterRef = useRef('');
  const filtersRef = useRef<ServerFilters>(DEFAULT_FILTERS);

  const applyLocalFilter = useCallback((tours: Tour[], query: string): Tour[] => {
    const q = query.toLowerCase().trim();
    return q ? tours.filter((t) => (t.name || '').toLowerCase().includes(q)) : tours;
  }, []);

  const loadTours = useCallback(
    async (serverFilters: ServerFilters, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        // Server handles sorting + type + date filters; client handles status + name
        const tours = await Api.fetchAllTours(signal, serverFilters);
        if (signal?.aborted) return;
        setAllTours(tours);
        setFilteredTours(applyLocalFilter(tours, filterRef.current));
      } catch (e) {
        if (signal?.aborted) return;
        if (e instanceof AuthExpiredError) onAuthError();
        else setError('Failed to load tours. Please try again.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [onAuthError, applyLocalFilter],
  );

  useEffect(() => {
    if (!authenticated) {
      setAllTours([]);
      setFilteredTours([]);
      setTree(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    loadTours(filtersRef.current, controller.signal);
    return () => controller.abort();
  }, [authenticated, loadTours]);

  useEffect(() => {
    setTree(buildTree(filteredTours));
  }, [filteredTours]);

  const handleFilter = useCallback(
    (query: string) => {
      filterRef.current = query;
      setFilteredTours(applyLocalFilter(allTours, query));
    },
    [allTours, applyLocalFilter],
  );

  const handleServerFiltersChange = useCallback(
    (newFilters: ServerFilters) => {
      setFilters(newFilters);
      filtersRef.current = newFilters;
      const controller = new AbortController();
      loadTours(newFilters, controller.signal);
    },
    [loadTours],
  );

  const applyTourUpdate = useCallback((tourId: number, updates: Partial<Tour>) => {
    setAllTours((prev) =>
      prev.map((t) => (t.id === tourId ? { ...t, ...updates } : t)),
    );
    const q = filterRef.current.toLowerCase().trim();
    setFilteredTours((prev) => {
      const updated = prev.map((t) =>
        t.id === tourId ? { ...t, ...updates } : t,
      );
      return q
        ? updated.filter((t) => (t.name || '').toLowerCase().includes(q))
        : updated;
    });
  }, []);

  const addTour = useCallback((tour: Tour) => {
    setAllTours((prev) => [tour, ...prev]);
    const q = filterRef.current.toLowerCase().trim();
    if (!q || (tour.name || '').toLowerCase().includes(q)) {
      setFilteredTours((prev) => [tour, ...prev]);
    }
  }, []);

  return {
    allTours,
    filteredTours,
    tree,
    loading,
    error,
    filters,
    handleFilter,
    handleServerFiltersChange,
    applyTourUpdate,
    addTour,
  } as const;
}
