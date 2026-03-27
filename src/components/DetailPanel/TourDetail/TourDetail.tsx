import type { Coordinate, Tour } from '../../../types.ts';

import {
  formatDate,
  formatDist,
  formatDur,
  sportIcon,
} from '../../../logic/utils.ts';
import { ElevationProfile } from '../ElevationProfile/ElevationProfile.tsx';
import styles from './TourDetail.module.css';

interface Props {
  tour: Tour;
  coords: Coordinate[] | null;
  onRename: (tour: Tour) => void;
}

export function TourDetail({ tour, coords, onRename }: Props) {
  const isRecorded = tour.type === 'tour_recorded';

  const stats: [string, string][] = [
    ['Distance', formatDist(tour.distance)],
    ['Duration', formatDur(tour.duration)],
    ['Elevation ↑', tour.elevation_up ? Math.round(tour.elevation_up) + ' m' : '–'],
    [
      'Elevation ↓',
      tour.elevation_down ? Math.round(tour.elevation_down) + ' m' : '–',
    ],
    ['Sport', tour.sport || '–'],
    ['Status', tour.status || '–'],
  ];

  return (
    <>
      <div class={styles.header}>
        <div class={styles.titleRow}>
          <div class={styles.title}>
            {sportIcon(tour.sport)} {tour.name || 'Unnamed'}
          </div>
          <div class={styles.subtitle}>
            {isRecorded ? '✅ Recorded' : '📋 Planned'} · {tour.sport || 'Unknown'} ·{' '}
            {formatDate(tour.date)}
          </div>
        </div>
        <button class={styles.renameBtn} onClick={() => onRename(tour)}>
          ✏️ Rename
        </button>
      </div>

      <div class={styles.grid}>
        {stats.map(([label, value]) => (
          <div key={label} class={styles.stat}>
            <div class={styles.statLabel}>{label}</div>
            <div class={styles.statValue}>{value}</div>
          </div>
        ))}
      </div>

      {coords && coords.length >= 2 && <ElevationProfile coords={coords} />}
    </>
  );
}
