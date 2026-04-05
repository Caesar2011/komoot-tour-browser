import type { Coordinate, CoverImage, SportType, Tour } from '../types.ts';
import { CONFIG, SPORT_ICONS } from '../config.ts';

export function encodeBase64(str: string): string {
  return btoa(String.fromCodePoint(...new TextEncoder().encode(str)));
}

export function basicAuthHeader(user: string, pass: string): string {
  return 'Basic ' + encodeBase64(user + ':' + pass);
}

export function sportIcon(sport: SportType): string {
  return (SPORT_ICONS as Record<string, string>)[sport] || '🏃';
}

export function formatDist(m: number): string {
  return (m / 1000).toFixed(1) + ' km';
}

export function formatDur(s: number): string {
  if (!s || s <= 0) return '–';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '–';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Sort tours by date descending (newest first). */
export function sortToursByDate(tours: Tour[]): Tour[] {
  return [...tours].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/** Haversine cumulative distance in meters for coordinate arrays. */
export function cumulativeDistances(coords: Coordinate[]): number[] {
  const R = 6371000;
  const dists = [0];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h =
      sinLat * sinLat +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        sinLng *
        sinLng;
    dists.push(
      dists[i - 1] + R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)),
    );
  }
  return dists;
}

/** Pick a "nice" round step value for axis ticks. */
export function niceStep(range: number, maxTicks: number): number {
  if (!range || !maxTicks || !isFinite(range) || !isFinite(maxTicks)) return 1;
  const rough = range / maxTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const res = rough / mag;
  let nice: number;
  if (res <= 1) nice = 1;
  else if (res <= 2) nice = 2;
  else if (res <= 5) nice = 5;
  else nice = 10;
  return nice * mag || 1;
}

/** Resolve a templated cover image URL to a concrete URL. */
export function resolveCoverImageUrl(
  img: CoverImage,
  width: number = CONFIG.COVER_IMAGE_WIDTH,
  height: number = CONFIG.COVER_IMAGE_HEIGHT,
): string {
  if (!img.src) return '';
  if (img.templated) {
    return img.src
      .replace('{width}', String(width))
      .replace('{height}', String(height))
      .replace('{crop}', 'true');
  }
  return img.src;
}

/** Trigger a file download in the browser. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Detect file type from extension. */
export function detectDataType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'gpx') return 'gpx';
  if (ext === 'fit') return 'fit';
  if (ext === 'tcx') return 'tcx';
  return 'gpx';
}

/** Returns true if the tour belongs to the currently authenticated user. */
export function isOwnTour(tour: Tour, userId: string): boolean {
  if (!userId) return false;
  const creatorId = tour._embedded?.creator?.username;
  return !creatorId || creatorId === userId;
}
