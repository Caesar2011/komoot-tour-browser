import type { Tour } from '../types.ts';

import { Api } from './api.ts';
import { isOwnTour } from './utils.ts';

/** Coerce a tour ID to number — Komoot returns IDs as strings at runtime. */
export function numericId(tour: { id: number }): number {
  return Number(tour.id);
}

/** Resolve the display name for a tour, preferring custom name for foreign tours. */
export function resolveDisplayName(
  tour: Tour,
  customNames: Map<number, string>,
): string {
  const custom = customNames.get(numericId(tour));
  return custom ?? tour.name;
}

/** Returns true if this tour has a locally stored custom name. */
export function hasCustomName(
  tour: Tour,
  customNames: Map<number, string>,
  userId: string,
): boolean {
  if (isOwnTour(tour, userId)) return false;
  return customNames.has(numericId(tour));
}

/**
 * Rename a tour — unified entry point.
 * Own tours → Komoot API. Foreign tours → local custom name.
 * An empty `newName` for foreign tours deletes the custom name mapping.
 */
export async function renameTourUnified(
  tour: Tour,
  newName: string,
  userId: string,
  setCustomName: (tourId: number, name: string) => Promise<void>,
  applyTourUpdate: (tourId: number, updates: Partial<Tour>) => void,
  updateDetailTour: (tourId: number, updates: Partial<Tour>) => void,
): Promise<void> {
  if (isOwnTour(tour, userId)) {
    await Api.renameTour(tour.id, newName);
    applyTourUpdate(tour.id, { name: newName });
    updateDetailTour(tour.id, { name: newName });
  } else {
    await setCustomName(numericId(tour), newName);
  }
}

/**
 * Compute the new full name when a tour is moved to `targetPrefix`.
 * Uses `_leafName` or falls back to the last segment of the display name.
 */
export function computeMovedName(
  tour: Tour,
  targetPrefix: string,
  customNames: Map<number, string>,
): string {
  const display = resolveDisplayName(tour, customNames);
  const leafName = tour._leafName || display.split(' / ').pop() || display;
  return targetPrefix ? `${targetPrefix} / ${leafName}` : leafName;
}
