import { describe, expect, it } from 'vitest';

import type { Coordinate } from '../types.ts';

import {
  cumulativeDistances,
  formatDate,
  formatDist,
  formatDur,
  niceStep,
  sportIcon,
} from './utils.ts';

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
});
