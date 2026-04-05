import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import type { Filters, Tour, TreeNode } from '../types.ts';
import { DEFAULT_FILTERS } from '../types.ts';
import { Api, AuthExpiredError } from '../logic/api.ts';
import { applyFilters } from '../logic/filters.ts';
import { buildTree } from '../logic/tree.ts';
import { applyCustomNames } from '../logic/customNames.ts';

export function useTours(
  authenticated: boolean,
  onAuthError: () => void,
  customNames: Map<number, string> = new Map(),
  userId: string = '',
) {
  const [allTours, setAllTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const loadTours = useCallback(
    (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      return Api.fetchAllTours(signal)
        .then((tours) => {
          if (!signal.aborted) setAllTours(tours);
        })
        .catch((e) => {
          if (signal.aborted) return;
          if (e instanceof AuthExpiredError) onAuthError();
          else setError('Failed to load tours. Please try again.');
        })
        .finally(() => {
          if (!signal.aborted) setLoading(false);
        });
    },
    [onAuthError],
  );

  useEffect(() => {
    if (!authenticated) {
      setAllTours([]);
      setError(null);
      return;
    }
    const controller = new AbortController();
    loadTours(controller.signal);
    return () => controller.abort();
  }, [authenticated, loadTours]);

  const refreshTours = useCallback(async () => {
    await Api.invalidateToursCache();
    const controller = new AbortController();
    await loadTours(controller.signal);
  }, [loadTours]);

  const displayTours = useMemo(
    () => applyCustomNames(allTours, customNames, userId),
    [allTours, customNames, userId],
  );

  const filteredTours = useMemo(
    () => applyFilters(displayTours, filters),
    [displayTours, filters],
  );

  const tree = useMemo<TreeNode | null>(
    () => buildTree(filteredTours),
    [filteredTours],
  );

  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
  }, []);

  const applyTourUpdate = useCallback(
    (tourId: number, updates: Partial<Tour>) => {
      setAllTours((prev) =>
        prev.map((t) => (t.id === tourId ? { ...t, ...updates } : t)),
      );
    },
    [],
  );

  const addTour = useCallback((tour: Tour) => {
    setAllTours((prev) => [tour, ...prev]);
  }, []);

  const removeTour = useCallback((tourId: number) => {
    setAllTours((prev) => prev.filter((t) => t.id !== tourId));
  }, []);

  return {
    allTours,
    filteredTours,
    tree,
    loading,
    error,
    filters,
    handleFiltersChange,
    applyTourUpdate,
    addTour,
    removeTour,
    refreshTours,
  };
}
