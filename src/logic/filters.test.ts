import { describe, expect, it } from 'vitest';

import type { Filters, Tour } from '../types.ts';
import { DEFAULT_FILTERS } from '../types.ts';

import { applyFilters } from './filters.ts';

function makeTour(overrides: Partial<Tour> = {}): Tour {
  return {
    id: 1,
    name: 'Test Tour',
    sport: 'hike',
    type: 'tour_recorded',
    distance: 10000,
    duration: 3600,
    status: 'public',
    date: '2025-06-15T10:00:00Z',
    ...overrides,
  };
}

function filters(overrides: Partial<Filters> = {}): Filters {
  return { ...DEFAULT_FILTERS, ...overrides };
}

describe('applyFilters', () => {
  it('returns all tours with default filters', () => {
    const tours = [makeTour({ id: 1 }), makeTour({ id: 2 })];
    expect(applyFilters(tours, DEFAULT_FILTERS)).toHaveLength(2);
  });

  it('filters by type', () => {
    const tours = [
      makeTour({ id: 1, type: 'tour_recorded' }),
      makeTour({ id: 2, type: 'tour_planned' }),
    ];
    const result = applyFilters(tours, filters({ type: 'tour_planned' }));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('filters by status', () => {
    const tours = [
      makeTour({ id: 1, status: 'public' }),
      makeTour({ id: 2, status: 'private' }),
      makeTour({ id: 3, status: 'friends' }),
    ];
    const result = applyFilters(tours, filters({ statusPrivate: true }));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('filters by name query', () => {
    const tours = [
      makeTour({ id: 1, name: 'Alps / Summit Hike' }),
      makeTour({ id: 2, name: 'Beach Walk' }),
    ];
    const result = applyFilters(tours, filters({ nameQuery: 'summit' }));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('sorts by name ascending', () => {
    const tours = [
      makeTour({ id: 1, name: 'Bravo' }),
      makeTour({ id: 2, name: 'Alpha' }),
    ];
    const result = applyFilters(
      tours,
      filters({ sortField: 'name', sortDirection: 'asc' }),
    );
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(1);
  });

  it('sorts by distance descending', () => {
    const tours = [
      makeTour({ id: 1, distance: 5000 }),
      makeTour({ id: 2, distance: 15000 }),
    ];
    const result = applyFilters(
      tours,
      filters({ sortField: 'distance', sortDirection: 'desc' }),
    );
    expect(result[0].id).toBe(2);
  });

  it('filters by date range', () => {
    const tours = [
      makeTour({ id: 1, date: '2025-01-01T00:00:00Z' }),
      makeTour({ id: 2, date: '2025-06-15T00:00:00Z' }),
      makeTour({ id: 3, date: '2025-12-31T00:00:00Z' }),
    ];
    const result = applyFilters(
      tours,
      filters({ startDate: '2025-03-01', endDate: '2025-09-01' }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('combines multiple filters', () => {
    const tours = [
      makeTour({
        id: 1,
        type: 'tour_recorded',
        status: 'public',
        name: 'Hike A',
      }),
      makeTour({
        id: 2,
        type: 'tour_planned',
        status: 'public',
        name: 'Hike B',
      }),
      makeTour({
        id: 3,
        type: 'tour_recorded',
        status: 'private',
        name: 'Hike C',
      }),
    ];
    const result = applyFilters(
      tours,
      filters({
        type: 'tour_recorded',
        statusPublic: true,
        nameQuery: 'hike',
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});
