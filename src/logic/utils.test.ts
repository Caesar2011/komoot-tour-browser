import { describe, expect, it } from 'vitest';

import type { Coordinate, Tour } from '../types.ts';

import {
  cumulativeDistances,
  formatDate,
  formatDist,
  formatDur,
  niceStep,
  pluralizeTours,
  sortToursByDate,
  sportIcon,
} from './utils.ts';

function makeTour(name: string, id: number, date?: string): Tour {
  return {
    id,
    name,
    sport: 'hike',
    type: 'tour_recorded',
    distance: 1000,
    duration: 600,
    date,
  };
}

describe('sportIcon', () => {
  it('returns known icon', () => {
    expect(sportIcon('hike')).toBe('🥾');
  });

  it('returns default for unknown sport', () => {
    expect(sportIcon('unknown_sport')).toBe('🏃');
  });
});

describe('formatDist', () => {
  it('converts meters to km', () => {
    expect(formatDist(12345)).toBe('12.3 km');
  });
});

describe('formatDur', () => {
  it('formats hours and minutes', () => {
    expect(formatDur(3661)).toBe('1h 1m');
  });

  it('formats minutes only', () => {
    expect(formatDur(300)).toBe('5m');
  });

  it('returns dash for zero', () => {
    expect(formatDur(0)).toBe('–');
  });
});

describe('formatDate', () => {
  it('returns dash for undefined', () => {
    expect(formatDate(undefined)).toBe('–');
  });

  it('formats a valid ISO string', () => {
    const result = formatDate('2024-06-15T10:00:00Z');
    expect(result).toContain('2024');
  });
});

describe('pluralizeTours', () => {
  it('singular', () => {
    expect(pluralizeTours(1)).toBe('1 tour');
  });

  it('plural', () => {
    expect(pluralizeTours(5)).toBe('5 tours');
  });

  it('zero', () => {
    expect(pluralizeTours(0)).toBe('0 tours');
  });
});

describe('sortToursByDate', () => {
  it('sorts tours by date descending', () => {
    const tours = [
      makeTour('A', 1, '2024-01-01'),
      makeTour('C', 3, '2024-03-01'),
      makeTour('B', 2, '2024-02-01'),
    ];
    const sorted = sortToursByDate(tours);
    expect(sorted.map((t) => t.id)).toEqual([3, 2, 1]);
  });

  it('handles missing dates', () => {
    const tours = [makeTour('A', 1), makeTour('B', 2, '2024-01-01')];
    const sorted = sortToursByDate(tours);
    expect(sorted[0].id).toBe(2);
  });
});

describe('cumulativeDistances', () => {
  it('returns [0] for single point', () => {
    const coords: Coordinate[] = [{ lat: 48, lng: 12 }];
    expect(cumulativeDistances(coords)).toEqual([0]);
  });

  it('returns increasing distances', () => {
    const coords: Coordinate[] = [
      { lat: 48, lng: 12 },
      { lat: 48.001, lng: 12 },
      { lat: 48.002, lng: 12 },
    ];
    const dists = cumulativeDistances(coords);
    expect(dists).toHaveLength(3);
    expect(dists[1]).toBeGreaterThan(0);
    expect(dists[2]).toBeGreaterThan(dists[1]);
  });
});

describe('niceStep', () => {
  it('returns a positive number', () => {
    expect(niceStep(100, 5)).toBeGreaterThan(0);
  });

  it('returns 1 for small ranges', () => {
    expect(niceStep(4, 5)).toBe(1);
  });

  it('returns 1 for zero range', () => {
    expect(niceStep(0, 5)).toBe(1);
  });

  it('returns 1 for zero maxTicks', () => {
    expect(niceStep(100, 0)).toBe(1);
  });

  it('returns 1 for infinite range', () => {
    expect(niceStep(Infinity, 5)).toBe(1);
  });
});
