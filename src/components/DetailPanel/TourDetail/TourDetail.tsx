import { useState } from 'preact/hooks';

import type {
  Coordinate,
  CoverImage,
  ExportFormat,
  FolderContext,
  SurfaceSegment,
  TimelineEntry,
  Tour,
  TourStatus,
  WayTypeSegment,
} from '../../../types.ts';
import { SPORT_LABELS, UNIQUE_SPORTS } from '../../../config.ts';
import {
  formatDate,
  formatDist,
  formatDur,
  isOwnTour,
  resolveCoverImageUrl,
  resolveRawCoverUrl,
  sportIcon,
} from '../../../logic/utils.ts';
import { Api } from '../../../logic/api.ts';
import { komootTourUrl } from '../../../logic/komoot.ts';
import { downloadTour } from '../../../logic/export.ts';
import {
  resolveDisplayName,
  hasCustomName as checkCustomName,
} from '../../../logic/tourName.ts';
import { SplitExportButton } from '../../SplitExportButton/SplitExportButton.tsx';
import { ElevationProfile } from '../ElevationProfile/ElevationProfile.tsx';

import styles from './TourDetail.module.css';

interface Props {
  tour: Tour;
  coords: Coordinate[] | null;
  timeline: TimelineEntry[];
  coverImages: CoverImage[];
  wayTypes: WayTypeSegment[];
  surfaces: SurfaceSegment[];
  folderContext: FolderContext | null;
  onRename: (tour: Tour) => void;
  onPatchTour: (
    tourId: number,
    fields: Partial<{ sport: string; status: TourStatus }>,
  ) => Promise<void>;
  onDeleteTour: (tour: Tour) => void;
  onRefresh: (tour: Tour, folderContext: FolderContext | null) => Promise<void>;
  lastExportFormat: ExportFormat;
  onSetExportFormat: (f: ExportFormat) => void;
  customNames: Map<number, string>;
}

function getTourOwner(tour: Tour): string {
  return (
    (tour._embedded?.creator?.display_name ??
      tour._embedded?.creator?.username ??
      Api.displayName) ||
    Api.userId ||
    '–'
  );
}

export function TourDetail({
  tour,
  coords,
  timeline,
  coverImages,
  wayTypes,
  surfaces,
  folderContext,
  onRename,
  onPatchTour,
  onDeleteTour,
  onRefresh,
  lastExportFormat,
  onSetExportFormat,
  customNames,
}: Props) {
  const isRecorded = tour.type === 'tour_recorded';
  const owned = isOwnTour(tour, Api.userId);
  const hasCustom = checkCustomName(tour, customNames, Api.userId);
  const displayName = resolveDisplayName(tour, customNames);

  const [patchError, setPatchError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleExport = async (format: ExportFormat) => {
    setDownloading(true);
    try {
      await downloadTour(tour.id, displayName, format);
    } catch {
      /* silently ignore */
    } finally {
      setDownloading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh(tour, folderContext);
    } finally {
      setRefreshing(false);
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

  const resolvedCovers = coverImages
    .slice(0, 6)
    .map((img) => resolveCoverImageUrl(img, 400, 240))
    .filter(Boolean);

  const timelineImages = timeline
    .filter((e) => e.cover?.src)
    .slice(0, 12)
    .map((e) => resolveRawCoverUrl(e.cover!.src, e.cover!.templated, 300, 200))
    .filter(Boolean);

  const canEditSport = owned && isRecorded;
  const sportLabel = SPORT_LABELS[tour.sport] || tour.sport;
  const tourOwner = getTourOwner(tour);

  const renameLabel = owned ? '✏️ Rename' : '🏷️ Custom Name';
  const renameTitle = owned
    ? 'Rename'
    : hasCustom
      ? 'Edit custom name (overrides displayed name locally)'
      : 'Set a custom local name for this tour';

  return (
    <>
      <div class={styles.header}>
        <div class={styles.titleRow}>
          <div class={styles.title}>
            {sportIcon(tour.sport)} {displayName || 'Unnamed'}
            {hasCustom && (
              <span
                class={styles.customBadge}
                title={`Custom name — original: ${tour.name}`}
              >
                🏷️
              </span>
            )}
          </div>
          <div class={styles.subtitle}>
            {isRecorded ? '✅ Recorded' : '📋 Planned'} · {tourOwner} ·{' '}
            {formatDate(tour.date)}
          </div>
        </div>
        <div class={styles.actions}>
          <a
            class={styles.komootLink}
            href={komootTourUrl(tour.id)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Komoot"
          >
            🔗 Komoot
          </a>
          <button
            class={styles.actionBtn}
            onClick={() => onRename(tour)}
            title={renameTitle}
            tabIndex={0}
          >
            {renameLabel}
          </button>
          <SplitExportButton
            format={lastExportFormat}
            onExport={handleExport}
            onFormatChange={onSetExportFormat}
            disabled={downloading}
            size="md"
          />
          <button
            class={styles.actionBtn}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Force refresh from server (clears 48h cache)"
            tabIndex={0}
          >
            {refreshing ? '⏳' : '🔄'}
          </button>
          {owned && (
            <button
              class={`${styles.actionBtn} ${styles.deleteBtn}`}
              onClick={() => onDeleteTour(tour)}
              tabIndex={0}
            >
              🗑️ Delete
            </button>
          )}
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

      <div class={styles.editRow}>
        <div class={styles.editField}>
          <span class={styles.editLabel}>Sport</span>
          {canEditSport ? (
            <div class={styles.styledSelectWrap}>
              <select
                class={styles.styledSelect}
                value={tour.sport}
                onChange={(e) =>
                  handleSportChange((e.target as HTMLSelectElement).value)
                }
              >
                {!UNIQUE_SPORTS.some(([k]) => k === tour.sport) && (
                  <option value={tour.sport}>{sportLabel}</option>
                )}
                {UNIQUE_SPORTS.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span class={styles.editValue}>{sportLabel}</span>
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
                  {s === 'private' ? '🔒' : s === 'friends' ? '👥' : '🌍'} {s}
                </button>
              ))}
            </div>
          ) : (
            <span class={styles.editValue}>{tour.status || '–'}</span>
          )}
        </div>
      </div>

      {patchError && <div class={styles.patchError}>{patchError}</div>}

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

      {timelineImages.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Timeline</div>
          <div class={styles.imageGrid}>
            {timelineImages.map((src, i) => (
              <img
                key={i}
                class={styles.coverImg}
                src={src}
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
