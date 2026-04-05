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
import { SPORT_LABELS } from '../../../config.ts';
import {
  formatDate,
  formatDist,
  formatDur,
  isOwnTour,
  resolveCoverImageUrl,
  sportIcon,
} from '../../../logic/utils.ts';
import { Api } from '../../../logic/api.ts';
import { komootTourUrl } from '../../../logic/komoot.ts';
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
  onDownloadGpx: (tourId: number, name: string) => Promise<void>;
  onDownloadFit: (tourId: number, name: string) => Promise<void>;
  onDeleteTour: (tour: Tour) => void;
  onRefresh: (tour: Tour, folderContext: FolderContext | null) => Promise<void>;
  lastExportFormat: ExportFormat;
  onSetExportFormat: (f: ExportFormat) => void;
  customNames: Map<number, string>;
}

function getTourOwner(tour: Tour): string {
  if (tour._embedded?.creator?.display_name)
    return tour._embedded.creator.display_name;
  if (tour._embedded?.creator?.username) return tour._embedded.creator.username;
  return Api.displayName || Api.userId || '–';
}

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
  folderContext,
  onRename,
  onPatchTour,
  onDownloadGpx,
  onDownloadFit,
  onDeleteTour,
  onRefresh,
  lastExportFormat,
  onSetExportFormat,
  customNames,
}: Props) {
  const isRecorded = tour.type === 'tour_recorded';
  const owned = isOwnTour(tour, Api.userId);
  const hasCustomName = !owned && customNames.has(tour.id);
  const [patchError, setPatchError] = useState('');
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
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

  const handleDownload = async (format: ExportFormat) => {
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

  const handleExportClick = () => handleDownload(lastExportFormat);

  const handleFormatSelect = (format: ExportFormat) => {
    onSetExportFormat(format);
    handleDownload(format);
    setShowFormatMenu(false);
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

  const resolvedCovers = coverImages
    .slice(0, 6)
    .map((img) => resolveCoverImageUrl(img, 400, 240))
    .filter(Boolean);

  const timelineImages = timeline
    .filter((e) => e.cover?.src)
    .slice(0, 12)
    .map((e) => ({
      src: resolveTemplatedSrc(e.cover!.src, e.cover!.templated, 300, 200),
    }));

  const canEditSport = owned && isRecorded;
  const sportLabel = SPORT_LABELS[tour.sport] || tour.sport;
  const tourOwner = getTourOwner(tour);

  const renameLabel = owned ? '✏️ Rename' : '🏷️ Custom Name';
  const renameTitle = owned
    ? 'Rename'
    : hasCustomName
      ? 'Edit custom name (overrides displayed name locally)'
      : 'Set a custom local name for this tour';

  return (
    <>
      <div class={styles.header}>
        <div class={styles.titleRow}>
          <div class={styles.title}>
            {sportIcon(tour.sport)} {tour.name || 'Unnamed'}
            {hasCustomName && (
              <span
                class={styles.customBadge}
                title="Custom name applied locally"
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
          <div class={styles.splitExport}>
            <button
              class={styles.actionBtn}
              onClick={handleExportClick}
              disabled={downloading != null}
              tabIndex={0}
            >
              {downloading === lastExportFormat ? '⏳' : '📥'}{' '}
              {lastExportFormat.toUpperCase()}
            </button>
            <button
              class={styles.splitArrow}
              onClick={() => setShowFormatMenu(!showFormatMenu)}
              title="Choose format"
            >
              ▾
            </button>
            {showFormatMenu && (
              <div class={styles.formatMenu}>
                <button
                  class={`${styles.formatOption} ${lastExportFormat === 'gpx' ? styles.formatActive : ''}`}
                  onClick={() => handleFormatSelect('gpx')}
                >
                  GPX
                </button>
                <button
                  class={`${styles.formatOption} ${lastExportFormat === 'fit' ? styles.formatActive : ''}`}
                  onClick={() => handleFormatSelect('fit')}
                >
                  FIT
                </button>
              </div>
            )}
          </div>
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
                {!uniqueSports.some(([k]) => k === tour.sport) && (
                  <option value={tour.sport}>{sportLabel}</option>
                )}
                {uniqueSports.map(([key, label]) => (
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
