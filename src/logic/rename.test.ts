import { describe, expect, it } from 'vitest';

import type { Tour } from '../types.ts';

import { buildTree } from './tree.ts';
import {
  computeFolderRenames,
  computeFullPathRenames,
  pathToTourPrefix,
  replaceTourNamePrefix,
} from './rename.ts';

function makeTour(name: string, id: number): Tour {
  return {
    id,
    name,
    sport: 'hike',
    type: 'tour_recorded',
    distance: 1000,
    duration: 600,
  };
}

describe('pathToTourPrefix', () => {
  it('converts empty path to empty string', () => {
    expect(pathToTourPrefix('')).toBe('');
  });

  it('converts single segment', () => {
    expect(pathToTourPrefix('Alps')).toBe('Alps');
  });

  it('converts multi-segment path', () => {
    expect(pathToTourPrefix('Alps/Tyrol')).toBe('Alps / Tyrol');
  });

  it('converts deeply nested path', () => {
    expect(pathToTourPrefix('Europe/Alps/Tyrol')).toBe('Europe / Alps / Tyrol');
  });
});

describe('replaceTourNamePrefix', () => {
  it('replaces prefix in a tour with deeper path', () => {
    expect(
      replaceTourNamePrefix(
        'Alps / Tyrol / Summit Hike',
        'Alps / Tyrol',
        'Alps / Dolomites',
      ),
    ).toBe('Alps / Dolomites / Summit Hike');
  });

  it('replaces exact match (tour directly in folder)', () => {
    // Edge case: a tour whose entire name IS the folder prefix shouldn't happen
    // in normal use, but handle gracefully
    expect(
      replaceTourNamePrefix('Alps / Tyrol', 'Alps / Tyrol', 'Alps / Dolomites'),
    ).toBe('Alps / Dolomites');
  });

  it('returns original name when prefix does not match', () => {
    expect(
      replaceTourNamePrefix('Beach / Walk', 'Alps / Tyrol', 'Alps / Dolomites'),
    ).toBe('Beach / Walk');
  });

  it('handles empty old prefix', () => {
    expect(replaceTourNamePrefix('Any Tour', '', 'New')).toBe('Any Tour');
  });

  it('handles single-segment prefix', () => {
    expect(replaceTourNamePrefix('Alps / Summit', 'Alps', 'Mountains')).toBe(
      'Mountains / Summit',
    );
  });
});

describe('computeFolderRenames', () => {
  it('renames all tours in a flat folder', () => {
    const tours = [
      makeTour('Trips / Morning Run', 1),
      makeTour('Trips / Evening Walk', 2),
    ];
    const tree = buildTree(tours);
    const results = computeFolderRenames('Trips', 'Adventures', tree);

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.tourId === 1)!.newName).toBe(
      'Adventures / Morning Run',
    );
    expect(results.find((r) => r.tourId === 2)!.newName).toBe(
      'Adventures / Evening Walk',
    );
  });

  it('renames tours in nested subfolders', () => {
    const tours = [
      makeTour('Europe / Alps / Summit Hike', 1),
      makeTour('Europe / Alps / Tyrol / Valley Walk', 2),
      makeTour('Europe / Alps / Easy Trail', 3),
    ];
    const tree = buildTree(tours);
    const results = computeFolderRenames('Europe/Alps', 'Dolomites', tree);

    expect(results).toHaveLength(3);
    expect(results.find((r) => r.tourId === 1)!.newName).toBe(
      'Europe / Dolomites / Summit Hike',
    );
    expect(results.find((r) => r.tourId === 2)!.newName).toBe(
      'Europe / Dolomites / Tyrol / Valley Walk',
    );
    expect(results.find((r) => r.tourId === 3)!.newName).toBe(
      'Europe / Dolomites / Easy Trail',
    );
  });

  it('renames a deeply nested folder', () => {
    const tours = [
      makeTour('A / B / C / Tour 1', 1),
      makeTour('A / B / C / D / Tour 2', 2),
    ];
    const tree = buildTree(tours);
    const results = computeFolderRenames('A/B/C', 'X', tree);

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.tourId === 1)!.newName).toBe(
      'A / B / X / Tour 1',
    );
    expect(results.find((r) => r.tourId === 2)!.newName).toBe(
      'A / B / X / D / Tour 2',
    );
  });

  it('returns empty for nonexistent path', () => {
    const tree = buildTree([makeTour('A / Tour', 1)]);
    expect(computeFolderRenames('Nonexistent', 'New', tree)).toEqual([]);
  });

  it('returns empty for path with no tours', () => {
    const tree = buildTree([]);
    expect(computeFolderRenames('', 'New', tree)).toEqual([]);
  });

  it('handles single tour in folder', () => {
    const tours = [makeTour('Solo / My Tour', 1)];
    const tree = buildTree(tours);
    const results = computeFolderRenames('Solo', 'Renamed', tree);

    expect(results).toHaveLength(1);
    expect(results[0].newName).toBe('Renamed / My Tour');
  });
});

describe('computeFullPathRenames', () => {
  it('renames with a full new path (intermediate rename)', () => {
    const tours = [
      makeTour('Europe / Alps / Tour 1', 1),
      makeTour('Europe / Alps / Sub / Tour 2', 2),
    ];
    const results = computeFullPathRenames(
      'Europe/Alps',
      'Europe/Mountains',
      tours,
    );

    expect(results).toHaveLength(2);
    expect(results[0].newName).toBe('Europe / Mountains / Tour 1');
    expect(results[1].newName).toBe('Europe / Mountains / Sub / Tour 2');
  });

  it('handles root-level rename', () => {
    const tours = [makeTour('Folder / A', 1), makeTour('Folder / B', 2)];
    const results = computeFullPathRenames('Folder', 'NewFolder', tours);

    expect(results).toHaveLength(2);
    expect(results[0].newName).toBe('NewFolder / A');
    expect(results[1].newName).toBe('NewFolder / B');
  });

  it('preserves deep structure on intermediate rename', () => {
    const tours = [makeTour('A / B / C / D / Tour', 1)];
    const results = computeFullPathRenames('A/B', 'A/X', tours);

    expect(results).toHaveLength(1);
    expect(results[0].newName).toBe('A / X / C / D / Tour');
  });
});
