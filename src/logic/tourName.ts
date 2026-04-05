import type { Tour } from '../types.ts';

import { Api } from './api.ts';
import { isOwnTour } from './utils.ts';

/** Resolve the display name for a tour, preferring custom name for foreign tours. */
export function resolveDisplayName(
  tour: Tour,
  customNames: Map<number, string>,
): string {
  return customNames.get(tour.id) ?? tour.name;
}

/** Returns true if this tour has a locally stored custom name. */
export function hasCustomName(
  tour: Tour,
  customNames: Map<number, string>,
  userId: string,
): boolean {
  if (isOwnTour(tour, userId)) return false;
  return customNames.has(tour.id);
}

/**
 * Rename a tour — unified entry point.
 * Own tours → Komoot API. Foreign tours → local custom name.
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
    await setCustomName(tour.id, newName);
  }
}

/**
 * Compute the new full name when a tour is moved to `targetPrefix`.
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
