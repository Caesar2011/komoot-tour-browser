import type { Tour, TrackEntry } from '../types.ts';
import { CONFIG } from '../config.ts';

import { Api } from './api.ts';

/** Build a track entry from cached coordinates or the tour's start point. */
export function buildPointEntry(
  tour: Tour,
  colorIdx: number,
  coverImageUrl?: string,
): TrackEntry | null {
  const color = CONFIG.COLORS[colorIdx % CONFIG.COLORS.length];
  const cached = Api.getCachedCoordinates(tour.id);
  if (cached && cached.length > 0) {
    return {
      tourId: tour.id,
      coords: cached,
      color,
      name: tour.name,
      coverImageUrl,
    };
  }
  if (tour.start_point) {
    return {
      tourId: tour.id,
      coords: [{ lat: tour.start_point.lat, lng: tour.start_point.lng }],
      color,
      name: tour.name,
      coverImageUrl,
    };
  }
  return null;
}
