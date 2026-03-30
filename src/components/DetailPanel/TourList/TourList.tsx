import type { Tour } from '../../../types.ts';

import { TourCard } from './TourCard.tsx';
import styles from './TourList.module.css';

interface Props {
  tours: Tour[];
  activeTourId: number | null;
  onSelectTour: (tour: Tour) => void;
}

export function TourList({ tours, activeTourId, onSelectTour }: Props) {
  return (
    <div class={styles.list}>
      {tours.map((tour) => (
        <TourCard
          key={tour.id}
          tour={tour}
          active={tour.id === activeTourId}
          onClick={() => onSelectTour(tour)}
        />
      ))}
    </div>
  );
}
