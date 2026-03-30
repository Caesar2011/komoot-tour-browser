import type { JSX } from 'preact';

import type {
  ServerFilters,
  SortDirection,
  SortField,
} from '../../../types.ts';

import styles from './FilterPanel.module.css';

interface Props {
  filters: ServerFilters;
  onChange: (filters: ServerFilters) => void;
}

export function FilterPanel({ filters, onChange }: Props) {
  const update = (partial: Partial<ServerFilters>) => {
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
        {/* Type toggle */}
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

        {/* Status toggles */}
        <div class={styles.row}>
          <span class={styles.label}>Status</span>
          <div class={styles.statusGroup}>
            <button
              class={`${styles.statusBtn} ${filters.statusPublic ? styles.active : ''}`}
              onClick={() => update({ statusPublic: !filters.statusPublic })}
            >
              🌍
            </button>
            <button
              class={`${styles.statusBtn} ${filters.statusFriends ? styles.active : ''}`}
              onClick={() => update({ statusFriends: !filters.statusFriends })}
            >
              👥
            </button>
            <button
              class={`${styles.statusBtn} ${filters.statusPrivate ? styles.active : ''}`}
              onClick={() => update({ statusPrivate: !filters.statusPrivate })}
            >
              🔒
            </button>
          </div>
        </div>

        {/* Date range */}
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
        </div>
        <div class={styles.row}>
          <span class={styles.label}>To</span>
          <input
            class={styles.dateInput}
            type="date"
            value={filters.endDate}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) =>
              update({ endDate: e.currentTarget.value })
            }
          />
        </div>

        {/* Sorting */}
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
