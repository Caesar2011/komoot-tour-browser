import { useState } from 'preact/hooks';

import type {
  Coordinate,
  CoverImage,
  SurfaceSegment,
  TimelineEntry,
  Tour,
  TourStatus,
  WayTypeSegment,
} from '../../../types.ts';
import { SPORT_LABELS } from '../../../config.ts';
import {
  formatDate,
  formatDist,
  formatDur,
  resolveCoverImageUrl,
  sportIcon,
} from '../../../logic/utils.ts';
import { Api } from '../../../logic/api.ts';
import { ElevationProfile } from '../ElevationProfile/ElevationProfile.tsx';

import styles from './TourDetail.module.css';

interface Props {
  tour: Tour;
  coords: Coordinate[] | null;
  timeline: TimelineEntry[];
  coverImages: CoverImage[];
  wayTypes: WayTypeSegment[];
  surfaces: SurfaceSegment[];
  onRename: (tour: Tour) => void;
  onPatchTour: (tourId: number, fields: Partial<{ sport: string; status: TourStatus }>) => Promise<void>;
  onDownloadGpx: (tourId: number, name: string) => Promise<void>;
  onDownloadFit: (tourId: number, name: string) => Promise<void>;
}

function isOwnTour(tour: Tour): boolean {
  const userId = Api.userId;
  if (!userId) return false;
  const creatorId = tour._embedded?.creator?.username;
  return !creatorId || creatorId === userId;
}

/** Resolve a templated image src (used for both cover images and timeline covers). */
function resolveTemplatedSrc(
  src: string,
  templated?: boolean,
  width = 400,
  height = 240,
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

export function TourDetail({
  tour,
  coords,
  timeline,
  coverImages,
  wayTypes,
  surfaces,
  onRename,
  onPatchTour,
  onDownloadGpx,
  onDownloadFit,
}: Props) {
  const isRecorded = tour.type === 'tour_recorded';
  const owned = isOwnTour(tour);
  const [patchError, setPatchError] = useState('');
  const [downloading, setDownloading] = useState<'gpx' | 'fit' | null>(null);

  const handleStatusChange = async (newStatus: TourStatus) => {
    if (newStatus === tour.status) return;
    setPatchError('');
    try {
      await onPatchTour(tour.id, { status: newStatus });
    } catch (e) {
      setPatchError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSportChange = async (newSport: string) => {
    if (newSport === tour.sport) return;
    setPatchError('');
    try {
      await onPatchTour(tour.id, { sport: newSport });
    } catch (e) {
      setPatchError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDownload = async (format: 'gpx' | 'fit') => {
    setDownloading(format);
    try {
      if (format === 'gpx') await onDownloadGpx(tour.id, tour.name);
      else await onDownloadFit(tour.id, tour.name);
    } catch {
      /* silently ignore */
    } finally {
      setDownloading(null);
    }
  };

  const stats: [string, string][] = [
    ['Distance', formatDist(tour.distance)],
    ['Duration', formatDur(tour.duration)],
    [
      'Elevation ↑',
      tour.elevation_up ? Math.round(tour.elevation_up) + ' m' : '–',
    ],
    [
      'Elevation ↓',
      tour.elevation_down ? Math.round(tour.elevation_down) + ' m' : '–',
    ],
  ];

  const seen = new Set<string>();
  const uniqueSports: [string, string][] = [];
  for (const [key, label] of Object.entries(SPORT_LABELS).sort(([, a], [, b]) =>
    a.localeCompare(b),
  )) {
    if (!seen.has(label)) {
      seen.add(label);
      uniqueSports.push([key, label]);
    }
  }

  // Cover images from the dedicated endpoint
  const resolvedCovers = coverImages
    .slice(0, 6)
    .map((img) => resolveCoverImageUrl(img, 400, 240))
    .filter(Boolean);

  // Timeline entries that have a cover image (the `cover` field on each item)
  const timelineImages = timeline
    .filter((e) => e.cover?.src)
    .slice(0, 12)
    .map((e) => ({
      src: resolveTemplatedSrc(e.cover!.src, e.cover!.templated, 300, 200),
    }));

  return (
    <>
      <div class={styles.header}>
        <div class={styles.titleRow}>
          <div class={styles.title}>
            {sportIcon(tour.sport)} {tour.name || 'Unnamed'}
          </div>
          <div class={styles.subtitle}>
            {isRecorded ? '✅ Recorded' : '📋 Planned'} ·{' '}
            {tour.sport || 'Unknown'} · {formatDate(tour.date)}
          </div>
        </div>
        <div class={styles.actions}>
          <button class={styles.actionBtn} onClick={() => onRename(tour)}>
            ✏️ Rename
          </button>
          <button
            class={styles.actionBtn}
            onClick={() => handleDownload('gpx')}
            disabled={downloading === 'gpx'}
          >
            {downloading === 'gpx' ? '⏳' : '📥'} GPX
          </button>
          <button
            class={styles.actionBtn}
            onClick={() => handleDownload('fit')}
            disabled={downloading === 'fit'}
          >
            {downloading === 'fit' ? '⏳' : '📥'} FIT
          </button>
        </div>
      </div>

      <div class={styles.grid}>
        {stats.map(([label, value]) => (
          <div key={label} class={styles.stat}>
            <div class={styles.statLabel}>{label}</div>
            <div class={styles.statValue}>{value}</div>
          </div>
        ))}
      </div>

      {/* Inline sport and status editing */}
      <div class={styles.editRow}>
        <div class={styles.editField}>
          <span class={styles.editLabel}>Sport</span>
          {owned ? (
            <select
              class={styles.inlineSelect}
              value={tour.sport}
              onChange={(e) =>
                handleSportChange((e.target as HTMLSelectElement).value)
              }
            >
              {!uniqueSports.some(([k]) => k === tour.sport) && (
                <option value={tour.sport}>{tour.sport}</option>
              )}
              {uniqueSports.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <span class={styles.editValue}>{SPORT_LABELS[tour.sport] || tour.sport}</span>
          )}
        </div>
        <div class={styles.editField}>
          <span class={styles.editLabel}>Status</span>
          {owned ? (
            <div class={styles.statusToggleGroup}>
              {(['private', 'friends', 'public'] as TourStatus[]).map((s) => (
                <button
                  key={s}
                  class={`${styles.statusToggle} ${tour.status === s ? styles.statusToggleActive : ''}`}
                  onClick={() => handleStatusChange(s)}
                >
                  {s === 'private' ? '🔒' : s === 'friends' ? '👥' : '🌍'}{' '}
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <span class={styles.editValue}>{tour.status || '–'}</span>
          )}
        </div>
      </div>

      {patchError && <div class={styles.patchError}>{patchError}</div>}

      {/* Cover images */}
      {resolvedCovers.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Cover Images</div>
          <div class={styles.imageGrid}>
            {resolvedCovers.map((src, i) => (
              <img
                key={i}
                class={styles.coverImg}
                src={src}
                alt={`Cover ${i + 1}`}
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}

      {/* Timeline images */}
      {timelineImages.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Timeline</div>
          <div class={styles.imageGrid}>
            {timelineImages.map((img, i) => (
              <img
                key={i}
                class={styles.coverImg}
                src={img.src}
                alt={`Timeline ${i + 1}`}
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}

      {coords && coords.length >= 2 && (
        <ElevationProfile
          coords={coords}
          wayTypes={wayTypes}
          surfaces={surfaces}
        />
      )}
    </>
  );
}
