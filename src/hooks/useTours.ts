import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import type { Filters, Tour, TreeNode } from '../types.ts';
import { DEFAULT_FILTERS } from '../types.ts';
import { Api, AuthExpiredError } from '../logic/api.ts';
import { applyFilters } from '../logic/filters.ts';
import { buildTree } from '../logic/tree.ts';

export function useTours(authenticated: boolean, onAuthError: () => void) {
  const [allTours, setAllTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  useEffect(() => {
    if (!authenticated) {
      setAllTours([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Api.fetchAllTours(controller.signal)
      .then((tours) => {
        if (!controller.signal.aborted) setAllTours(tours);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        if (e instanceof AuthExpiredError) onAuthError();
        else setError('Failed to load tours. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [authenticated, onAuthError]);

  const filteredTours = useMemo(
    () => applyFilters(allTours, filters),
    [allTours, filters],
  );

  const tree = useMemo<TreeNode | null>(
    () =>
      filteredTours.length > 0 || allTours.length === 0
        ? buildTree(filteredTours)
        : buildTree(filteredTours),
    [filteredTours, allTours.length],
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
  } as const;
}
