export const SPORT_ICONS = Object.freeze({
  hike: '🥾',
  hiking: '🥾',
  mountaineering: '⛰️',
  touringbicycle: '🚴',
  racebike: '🚴‍♂️',
  gravel_cycling: '🚴',
  mtb: '🚵',
  mtb_easy: '🚵',
  mtb_advanced: '🚵',
  mtb_enduro: '🚵',
  e_touringbicycle: '⚡',
  e_mtb: '⚡',
  e_racebike: '⚡',
  jogging: '🏃',
  running: '🏃',
  nordic: '⛷️',
  nordic_walking: '🚶',
  skitour: '⛷️',
  snowshoe: '🏔️',
  climbing: '🧗',
} as const);

export const SPORT_LABELS: Record<string, string> = {
  hike: 'Hiking',
  hiking: 'Hiking',
  mountaineering: 'Mountaineering',
  touringbicycle: 'Touring Bicycle',
  racebike: 'Race Bike',
  gravel_cycling: 'Gravel Cycling',
  mtb: 'Mountain Bike',
  mtb_easy: 'MTB Easy',
  mtb_advanced: 'MTB Advanced',
  mtb_enduro: 'MTB Enduro',
  e_touringbicycle: 'E-Touring',
  e_mtb: 'E-MTB',
  e_racebike: 'E-Race Bike',
  jogging: 'Running',
  running: 'Running',
  nordic: 'Cross-Country Skiing',
  nordic_walking: 'Nordic Walking',
  skitour: 'Ski Tour',
  snowshoe: 'Snowshoeing',
  climbing: 'Climbing',
};

/** Deduplicated sport entries sorted by label. Computed once at module load. */
export const UNIQUE_SPORTS: readonly [string, string][] = (() => {
  const seen = new Set<string>();
  const result: [string, string][] = [];
  for (const [key, label] of Object.entries(SPORT_LABELS).sort(([, a], [, b]) =>
    a.localeCompare(b),
  )) {
    if (!seen.has(label)) {
      seen.add(label);
      result.push([key, label]);
    }
  }
  return result;
})();

export const WAY_TYPE_COLORS: Record<string, string> = {
  'wt#street': '#e74c3c',
  'wt#primary': '#c0392b',
  'wt#minor_road': '#e67e22',
  'wt#service': '#d35400',
  'wt#cycleway': '#3498db',
  'wt#way': '#f39c12',
  'wt#path': '#2ecc71',
  'wt#track': '#27ae60',
  'wt#footway': '#1abc9c',
  'wt#trail_d1': '#16a085',
  'wt#trail_d2': '#9b59b6',
  'wt#trail_d3': '#8e44ad',
  'wt#stairs': '#7f8c8d',
  'wt#ferry': '#00bcd4',
};

export const SURFACE_COLORS: Record<string, string> = {
  'sb#asphalt': '#555555',
  'sb#paved': '#777777',
  'sb#concrete': '#bdc3c7',
  'sb#paving_stones': '#95a5a6',
  'sb#cobblestone': '#7f8c8d',
  'sb#gravel': '#c19a6b',
  'sb#compacted': '#b8860b',
  'sb#ground': '#8b6914',
  'sb#unpaved': '#a0522d',
  'sb#sand': '#f4d03f',
  'sb#grass': '#27ae60',
  'sb#wood': '#6d4c41',
};

export function elementLabel(element: string): string {
  const raw = element.includes('#') ? element.split('#')[1] : element;
  return raw
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const CONFIG = Object.freeze({
  API_BASE: 'https://api.komoot.de',
  API_WWW: 'https://www.komoot.com/api',
  PAGE_LIMIT: 500,
  TRACKS_EAGER_LIMIT: 30,
  TILE_URL:
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  TILE_ATTR:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  COLORS: [
    '#4a6cf7',
    '#e74c3c',
    '#2ecc71',
    '#f39c12',
    '#9b59b6',
    '#1abc9c',
    '#e67e22',
    '#3498db',
    '#e91e63',
    '#00bcd4',
  ],
  DEFAULT_CENTER: [48.0, 12.0] as [number, number],
  DEFAULT_ZOOM: 6,
  FILTER_DEBOUNCE_MS: 200,
  ELEVATION_CANVAS_HEIGHT: 140,
  ELEVATION_SAMPLES: 600,
  LOCALE: navigator.language?.split('-')[0] || 'en',
  MAP_STYLES: {
    TRACK_WEIGHT: 3,
    TRACK_OPACITY: 0.85,
    MARKER_RADIUS: 7,
    MARKER_WEIGHT: 2,
    START_MARKER_RADIUS: 5,
    START_MARKER_WEIGHT: 2,
  },
  COVER_IMAGE_WIDTH: 200,
  COVER_IMAGE_HEIGHT: 120,
  CACHE_TTL_MS: 48 * 60 * 60 * 1000,
  /** Delay to distinguish single-click from double-click in sidebar. */
  CLICK_ACTIVATE_DELAY_MS: 200,
});
