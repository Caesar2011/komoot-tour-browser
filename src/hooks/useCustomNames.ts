import { useCallback, useEffect, useState } from 'preact/hooks';

import { triggerDownload } from '../logic/utils.ts';
import {
  buildExportPayload,
  computeIsDirty,
  deleteCustomName,
  getLastExportedAt,
  loadCustomNames,
  mergeImport,
  parseImportPayload,
  saveCustomName,
  setLastExportedAt,
  type CustomNameRecord,
  type ImportResult,
} from '../logic/customNames.ts';
import { cnGetAll } from '../logic/cache.ts';

export type { ImportResult };

export interface UseCustomNamesReturn {
  customNames: Map<number, string>;
  isDirty: boolean;
  setCustomName(tourId: number, name: string): Promise<void>;
  deleteMapping(tourId: number): Promise<void>;
  exportMappings(): Promise<void>;
  importMappings(file: File): Promise<ImportResult>;
  /** All raw records (for the dialog table). */
  records: CustomNameRecord[];
}

export function useCustomNames(): UseCustomNamesReturn {
  const [customNames, setCustomNames] = useState<Map<number, string>>(
    () => new Map(),
  );
  const [records, setRecords] = useState<CustomNameRecord[]>([]);
  const [lastExportedAt, setLastExportedAtState] = useState<number | undefined>(
    undefined,
  );

  const isDirty = computeIsDirty(records, lastExportedAt);

  // Sync from IDB on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadCustomNames(), cnGetAll(), getLastExportedAt()]).then(
      ([names, recs, lastExported]) => {
        if (cancelled) return;
        setCustomNames(names);
        setRecords(recs);
        setLastExportedAtState(lastExported);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const setCustomName = useCallback(
    async (tourId: number, name: string): Promise<void> => {
      const trimmed = name.trim();
      await saveCustomName(tourId, trimmed);
      setCustomNames((prev) => {
        const next = new Map(prev);
        if (trimmed === '') next.delete(tourId);
        else next.set(tourId, trimmed);
        return next;
      });
      setRecords(await cnGetAll());
    },
    [],
  );

  const deleteMapping = useCallback(async (tourId: number): Promise<void> => {
    await deleteCustomName(tourId);
    setCustomNames((prev) => {
      const next = new Map(prev);
      next.delete(tourId);
      return next;
    });
    setRecords(await cnGetAll());
  }, []);

  const exportMappings = useCallback(async (): Promise<void> => {
    const recs = await cnGetAll();
    const payload = buildExportPayload(recs);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    triggerDownload(blob, 'komoot-custom-names.json');
    const now = Date.now();
    await setLastExportedAt(now);
    setLastExportedAtState(now);
  }, []);

  const importMappings = useCallback(
    async (file: File): Promise<ImportResult> => {
      const text = await file.text();
      const raw: unknown = JSON.parse(text);
      const payload = parseImportPayload(raw);
      const existing = await cnGetAll();
      const { result, merged } = await mergeImport(payload.mappings, existing);
      const now = Date.now();
      await setLastExportedAt(now);
      setLastExportedAtState(now);
      const nextNames = new Map(merged.map((r) => [r.tourId, r.name]));
      setCustomNames(nextNames);
      setRecords(merged);
      return result;
    },
    [],
  );

  return {
    customNames,
    isDirty,
    setCustomName,
    deleteMapping,
    exportMappings,
    importMappings,
    records,
  };
}
