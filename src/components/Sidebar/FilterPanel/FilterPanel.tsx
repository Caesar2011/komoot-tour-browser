import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';

import type {
  Filters,
  SortDirection,
  SortField,
  Tour,
} from '../../../types.ts';
import { SPORT_LABELS } from '../../../config.ts';
import { sportIcon } from '../../../logic/utils.ts';

import styles from './FilterPanel.module.css';

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  allTours: Tour[];
}

export function FilterPanel({ filters, onChange, allTours }: Props) {
  const update = (partial: Partial<Filters>) => {
    onChange({ ...filters, ...partial });
  };

  const cycleType = () => {
    if (filters.type === null) update({ type: 'tour_recorded' });
    else if (filters.type === 'tour_recorded') update({ type: 'tour_planned' });
    else update({ type: null });
  };

  const typeLabel =
    filters.type === 'tour_recorded'
      ? '✅ Recorded'
      : filters.type === 'tour_planned'
        ? '📋 Planned'
        : '⊘ All';

  const activeSports = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of allTours) {
      counts.set(t.sport, (counts.get(t.sport) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([sport]) => sport);
  }, [allTours]);

  const toggleSport = (sport: string) => {
    const next = filters.sports.includes(sport)
      ? filters.sports.filter((s) => s !== sport)
      : [...filters.sports, sport];
    update({ sports: next });
  };

  const getSportLabel = (sport: string): string => SPORT_LABELS[sport] || sport;

  return (
    <div class={styles.wrapper}>
      <input
        type="checkbox"
        id="filterToggle"
        class={styles.toggle}
        aria-label="Toggle filters"
      />
      <label htmlFor="filterToggle" class={styles.toggleLabel}>
        <span class={styles.toggleIcon}>▶</span>
        Filters & Sort
      </label>
      <div class={styles.panel}>
        <div class={styles.row}>
          <span class={styles.label}>Type</span>
          <button
            class={`${styles.toggleBtn} ${filters.type ? styles.active : ''}`}
            onClick={cycleType}
            title="Click to cycle: All → Recorded → Planned"
          >
            {typeLabel}
          </button>
        </div>

        <div class={styles.row}>
          <span class={styles.label}>Status</span>
          <div class={styles.statusGroup}>
            <button
              class={`${styles.statusBtn} ${filters.statusPrivate ? styles.active : ''}`}
              onClick={() => update({ statusPrivate: !filters.statusPrivate })}
            >
              🔒
            </button>
            <button
              class={`${styles.statusBtn} ${filters.statusFriends ? styles.active : ''}`}
              onClick={() => update({ statusFriends: !filters.statusFriends })}
            >
              👥
            </button>
            <button
              class={`${styles.statusBtn} ${filters.statusPublic ? styles.active : ''}`}
              onClick={() => update({ statusPublic: !filters.statusPublic })}
            >
              🌍
            </button>
          </div>
        </div>

        <div class={styles.row}>
          <span class={styles.label}>From</span>
          <input
            class={styles.dateInput}
            type="date"
            value={filters.startDate}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) =>
              update({ startDate: e.currentTarget.value })
            }
          />
          <span class={styles.dateSep}>To</span>
          <input
            class={styles.dateInput}
            type="date"
            value={filters.endDate}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) =>
              update({ endDate: e.currentTarget.value })
            }
          />
        </div>

        {activeSports.length > 0 && (
          <div class={styles.row}>
            <span class={styles.label}>Sport</span>
            <div class={styles.sportChips}>
              {activeSports.map((sport) => (
                <button
                  key={sport}
                  class={`${styles.sportChip} ${filters.sports.includes(sport) ? styles.active : ''}`}
                  onClick={() => toggleSport(sport)}
                  title={getSportLabel(sport)}
                >
                  {sportIcon(sport)} {getSportLabel(sport)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div class={styles.row}>
          <span class={styles.label}>Sort</span>
          <select
            class={styles.selectInput}
            value={filters.sortField}
            onChange={(e) =>
              update({
                sortField: (e.target as HTMLSelectElement).value as SortField,
              })
            }
          >
            <option value="date">Date</option>
            <option value="name">Name</option>
            <option value="distance">Distance</option>
            <option value="elevation">Elevation</option>
            <option value="duration">Duration</option>
          </select>
          <button
            class={styles.dirBtn}
            onClick={() =>
              update({
                sortDirection:
                  filters.sortDirection === 'asc'
                    ? ('desc' as SortDirection)
                    : ('asc' as SortDirection),
              })
            }
            title={filters.sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          >
            {filters.sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>
    </div>
  );
}
