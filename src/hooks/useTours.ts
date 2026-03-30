import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import type { Tour, TreeNode } from '../types.ts';
import { Api, AuthExpiredError } from '../logic/api.ts';
import { buildTree } from '../logic/tree.ts';

export function useTours(authenticated: boolean, onAuthError: () => void) {
  const [allTours, setAllTours] = useState<Tour[]>([]);
  const [filteredTours, setFilteredTours] = useState<Tour[]>([]);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterRef = useRef('');

  useEffect(() => {
    if (!authenticated) {
      setAllTours([]);
      setFilteredTours([]);
      setTree(null);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const tours = await Api.fetchAllTours(controller.signal);
        if (controller.signal.aborted) return;
        setAllTours(tours);
        setFilteredTours(tours);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof AuthExpiredError) onAuthError();
        else setError('Failed to load tours. Please try again.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [authenticated, onAuthError]);

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

  const applyRenameToState = useCallback((tourId: number, newName: string) => {
    setAllTours((prev) =>
      prev.map((t) => (t.id === tourId ? { ...t, name: newName } : t)),
    );

    const q = filterRef.current.toLowerCase().trim();
    setFilteredTours((prev) => {
      const updated = prev.map((t) =>
        t.id === tourId ? { ...t, name: newName } : t,
      );
      return q
        ? updated.filter((t) => (t.name || '').toLowerCase().includes(q))
        : updated;
    });
  }, []);

  return {
    allTours,
    filteredTours,
    tree,
    loading,
    error,
    handleFilter,
    applyRenameToState,
  } as const;
}
