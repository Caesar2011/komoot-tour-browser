import type { Tour } from '../types.ts';

import { Api } from './api.ts';

const KOMOOT_BASE = 'https://www.komoot.com/de-de';

/** Build a Komoot detail URL for a single tour. */
export function komootTourUrl(tourId: number): string {
  return `${KOMOOT_BASE}/tour/${tourId}`;
}

/** Build a Komoot search/activities URL for a folder of tours. */
export function komootFolderUrl(folderName: string, tours: Tour[]): string {
  const userId = Api.userId || '0';
  const params = new URLSearchParams();
  params.set('search', folderName);

  // Infer sport types from tours
  const sports = new Set(tours.map((t) => t.sport).filter(Boolean));
  if (sports.size === 1) {
    params.set('sport', [...sports][0]);
  }

  // Infer recorded/planned from tours
  const types = new Set(tours.map((t) => t.type));
  if (types.size === 1) {
    params.set('type', types.has('tour_recorded') ? 'recorded' : 'planned');
  }

  // Infer date range
  const dates = tours
    .map((t) => t.date)
    .filter(Boolean)
    .sort() as string[];
  if (dates.length > 0) {
    const startDate = dates[0].slice(0, 10);
    const endDate = dates[dates.length - 1].slice(0, 10);
    params.set('date', `${startDate},${endDate}`);
  }

  return `${KOMOOT_BASE}/user/${userId}/activities?${params.toString()}`;
}
