import type { Tour } from '../types.ts';

import {
  cnDelete,
  cnGetAll,
  cnPut,
  metaGet,
  metaPut,
  type CustomNameRecord,
} from './cache.ts';
import { isOwnTour } from './utils.ts';

export { type CustomNameRecord };

const META_KEY = 'customNamesExportedAt';

// ── IDB access ─────────────────────────────────────────────────────────────

/** Load all custom names from IDB into a Map<tourId, name>. */
export async function loadCustomNames(): Promise<Map<number, string>> {
  const records = await cnGetAll();
  return new Map(records.map((r) => [Number(r.tourId), r.name]));
}

/** Persist a custom name (empty string = delete). */
export async function saveCustomName(
  tourId: number,
  name: string,
  updatedAt: number = Date.now(),
): Promise<void> {
  // Always store tourId as a number, regardless of what the caller passes.
  const id = Number(tourId);
  if (name === '') {
    await cnDelete(id);
  } else {
    await cnPut({ tourId: id, name, updatedAt });
  }
}

/** Delete a custom name by tourId. */
export async function deleteCustomName(tourId: number): Promise<void> {
  await cnDelete(Number(tourId));
}

/** Read the global lastExportedAt timestamp (undefined if never exported). */
export async function getLastExportedAt(): Promise<number | undefined> {
  return metaGet<number>(META_KEY);
}

/** Persist the global lastExportedAt timestamp. */
export async function setLastExportedAt(ts: number): Promise<void> {
  await metaPut(META_KEY, ts);
}

// ── out-of-sync detection ──────────────────────────────────────────────────

/**
 * Returns true when there are unsaved changes:
 * - at least one entry exists AND lastExportedAt is missing, OR
 * - MAX(updatedAt) > lastExportedAt
 */
export function computeIsDirty(
  records: CustomNameRecord[],
  lastExportedAt: number | undefined,
): boolean {
  if (records.length === 0) return false;
  if (lastExportedAt === undefined) return true;
  const maxUpdated = Math.max(...records.map((r) => r.updatedAt));
  return maxUpdated > lastExportedAt;
}

// ── applyCustomNames ───────────────────────────────────────────────────────

/**
 * Pre-process a tour list by substituting custom names for foreign tours.
 * `buildTree` and all downstream consumers receive the substituted list.
 * `allTours` in state is never mutated.
 */
export function applyCustomNames(
  tours: Tour[],
  customNames: Map<number, string>,
  userId: string,
): Tour[] {
  if (customNames.size === 0) return tours;
  return tours.map((tour) => {
    if (isOwnTour(tour, userId)) return tour;
    const custom = customNames.get(tour.id);
    if (!custom) return tour;
    return { ...tour, name: custom };
  });
}

// ── export ─────────────────────────────────────────────────────────────────

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  mappings: CustomNameRecord[];
}

/** Serialize all records to the export JSON format. */
export function buildExportPayload(records: CustomNameRecord[]): ExportPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    // Ensure tourId is always serialized as a number.
    mappings: records.map((r) => ({ ...r, tourId: Number(r.tourId) })),
  };
}

// ── import ─────────────────────────────────────────────────────────────────

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

/**
 * Validate and parse a JSON import file.
 * Throws a descriptive Error on validation failure.
 * Accepts tourId as number or numeric string for forwards/backwards compatibility.
 */
export function parseImportPayload(raw: unknown): ExportPayload {
  if (typeof raw !== 'object' || raw === null)
    throw new Error('Invalid file: not a JSON object');
  const obj = raw as Record<string, unknown>;
  if (obj['version'] !== 1) throw new Error('Invalid file: missing version: 1');
  if (!Array.isArray(obj['mappings']))
    throw new Error('Invalid file: missing mappings array');

  const mappings: CustomNameRecord[] = [];
  for (const m of obj['mappings']) {
    if (typeof m !== 'object' || m === null) {
      throw new Error('Invalid file: each mapping must be an object');
    }
    const entry = m as Record<string, unknown>;
    const rawId = entry['tourId'];
    const numericId = Number(rawId);
    if (
      (typeof rawId !== 'number' && typeof rawId !== 'string') ||
      !Number.isFinite(numericId) ||
      numericId <= 0
    ) {
      throw new Error(
        'Invalid file: each mapping must have a valid numeric tourId',
      );
    }
    if (typeof entry['name'] !== 'string') {
      throw new Error('Invalid file: each mapping must have a string name');
    }
    if (typeof entry['updatedAt'] !== 'number') {
      throw new Error(
        'Invalid file: each mapping must have a numeric updatedAt',
      );
    }
    mappings.push({
      tourId: numericId,
      name: entry['name'],
      updatedAt: entry['updatedAt'],
    });
  }

  return {
    version: 1,
    exportedAt: (obj['exportedAt'] as string) ?? new Date().toISOString(),
    mappings,
  };
}

/**
 * Merge imported records with existing records using "newer wins" strategy.
 * Returns the result summary and the updated full records list.
 */
export async function mergeImport(
  incoming: CustomNameRecord[],
  existing: CustomNameRecord[],
): Promise<{ result: ImportResult; merged: CustomNameRecord[] }> {
  const existingMap = new Map(existing.map((r) => [Number(r.tourId), r]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of incoming) {
    const id = Number(record.tourId);
    const normalized = { ...record, tourId: id };
    const local = existingMap.get(id);
    if (!local) {
      existingMap.set(id, normalized);
      await cnPut(normalized);
      added++;
    } else if (record.updatedAt > local.updatedAt) {
      existingMap.set(id, normalized);
      await cnPut(normalized);
      updated++;
    } else {
      skipped++;
    }
  }

  return {
    result: { added, updated, skipped },
    merged: [...existingMap.values()],
  };
}
