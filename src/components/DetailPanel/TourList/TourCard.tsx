import type { Tour } from '../../../types.ts';
import {
  formatDate,
  formatDist,
  formatDur,
  sportIcon,
} from '../../../logic/utils.ts';

import styles from './TourList.module.css';

interface Props {
  tour: Tour;
  active: boolean;
  onClick: () => void;
}

export function TourCard({ tour, active, onClick }: Props) {
  const isRecorded = tour.type === 'tour_recorded';

  return (
    <div
      class={`${styles.card} ${active ? styles.active : ''}`}
      onClick={onClick}
    >
      <span class={styles.sportIcon}>{sportIcon(tour.sport)}</span>
      <div class={styles.info}>
        <div class={styles.name} title={tour.name}>
          {tour.name || 'Unnamed'}
        </div>
        <div class={styles.meta}>
          {formatDate(tour.date)} · {formatDist(tour.distance)} ·{' '}
          {formatDur(tour.duration)} · {tour.sport || ''}
        </div>
      </div>
      <span
        class={`${styles.badge} ${isRecorded ? styles.badgeRecorded : styles.badgePlanned}`}
      >
        {isRecorded ? 'Recorded' : 'Planned'}
      </span>
    </div>
  );
}
