import type { Coordinate, CoverImage, SportType, Tour } from '../types.ts';
import { CONFIG, SPORT_ICONS } from '../config.ts';

export function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return btoa(String.fromCharCode(...bytes));
}

export function basicAuthHeader(user: string, pass: string): string {
  return 'Basic ' + encodeBase64(user + ':' + pass);
}

export function sportIcon(sport: SportType): string {
  return SPORT_ICONS[sport] || '🏃';
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

/** Pluralize "tour" / "tours". */
export function pluralizeTours(count: number): string {
  return `${count} tour${count !== 1 ? 's' : ''}`;
}

export function sortToursByDate(tours: Tour[]): Tour[] {
  return [...tours].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

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

export function safeName(name: string): string {
  return (name || 'tour').replace(/[^a-zA-Z0-9_\-. ]/g, '_');
}

/** Resolve a CoverImage object to a URL. */
export function resolveCoverImageUrl(
  image: CoverImage,
  width: number = CONFIG.COVER_IMAGE_WIDTH,
  height: number = CONFIG.COVER_IMAGE_HEIGHT,
): string {
  if (!image.src) return '';
  if (image.templated) {
    return image.src
      .replace('{width}', String(width))
      .replace('{height}', String(height))
      .replace('{crop}', 'true');
  }
  return image.src;
}

/** Resolve a raw cover URL string with optional template substitution. */
export function resolveRawCoverUrl(
  src: string,
  templated: boolean | undefined,
  width: number = CONFIG.COVER_IMAGE_WIDTH,
  height: number = CONFIG.COVER_IMAGE_HEIGHT,
): string {
  if (!src) return '';
  if (templated) {
    return src
      .replace('{width}', String(width))
      .replace('{height}', String(height))
      .replace('{crop}', 'true');
  }
  return src;
}

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

export function detectDataType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'gpx') return 'gpx';
  if (ext === 'fit') return 'fit';
  if (ext === 'tcx') return 'tcx';
  return 'gpx';
}

export function isOwnTour(tour: Tour, userId: string): boolean {
  if (!userId) return false;
  const creatorId = tour._embedded?.creator?.username;
  return !creatorId || creatorId === userId;
}
