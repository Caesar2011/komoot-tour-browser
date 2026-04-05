import { describe, expect, it } from 'vitest';

import type { SelectionItem, SelectionItemKey, Tour } from '../types.ts';

import { buildTree } from './tree.ts';
import {
  resolveEffectiveTours,
  computeMoveRenames,
  isFolderInSelection,
} from './selection.ts';

function makeTour(name: string, id: number): Tour {
  return {
    id,
    name,
    sport: 'hike',
    type: 'tour_recorded',
    distance: 10000,
    duration: 3600,
  };
}

function makeSelected(
  items: SelectionItem[],
): Map<SelectionItemKey, SelectionItem> {
  const map = new Map<SelectionItemKey, SelectionItem>();
  for (const item of items) {
    const key =
      item.type === 'tour' ? `tour:${item.tourId}` : `folder:${item.path}`;
    map.set(key, item);
  }
  return map;
}

describe('resolveEffectiveTours', () => {
  it('resolves a single selected tour', () => {
    const tours = [makeTour('A / Tour1', 1), makeTour('B / Tour2', 2)];
    const tree = buildTree(tours);
    const selected = makeSelected([{ type: 'tour', path: 'A', tourId: 1 }]);
    const result = resolveEffectiveTours(selected, tree);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('resolves a selected folder', () => {
    const tours = [
      makeTour('A / Tour1', 1),
      makeTour('A / Tour2', 2),
      makeTour('B / Tour3', 3),
    ];
    const tree = buildTree(tours);
    const selected = makeSelected([{ type: 'folder', path: 'A' }]);
    const result = resolveEffectiveTours(selected, tree);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id).sort()).toEqual([1, 2]);
  });

  it('deduplicates child when parent folder is selected', () => {
    const tours = [makeTour('A / B / Tour1', 1), makeTour('A / Tour2', 2)];
    const tree = buildTree(tours);
    const selected = makeSelected([
      { type: 'folder', path: 'A' },
      { type: 'tour', path: 'A/B', tourId: 1 },
    ]);
    const result = resolveEffectiveTours(selected, tree);
    expect(result).toHaveLength(2);
  });

  it('deduplicates nested folder when ancestor is selected', () => {
    const tours = [makeTour('A / B / Tour1', 1)];
    const tree = buildTree(tours);
    const selected = makeSelected([
      { type: 'folder', path: 'A' },
      { type: 'folder', path: 'A/B' },
    ]);
    const result = resolveEffectiveTours(selected, tree);
    expect(result).toHaveLength(1);
  });
});

describe('isFolderInSelection', () => {
  it('returns true for exact match', () => {
    const selected = makeSelected([{ type: 'folder', path: 'A/B' }]);
    expect(isFolderInSelection('A/B', selected)).toBe(true);
  });

  it('returns true for child of selected folder', () => {
    const selected = makeSelected([{ type: 'folder', path: 'A' }]);
    expect(isFolderInSelection('A/B', selected)).toBe(true);
  });

  it('returns false for unrelated folder', () => {
    const selected = makeSelected([{ type: 'folder', path: 'A' }]);
    expect(isFolderInSelection('B', selected)).toBe(false);
  });
});

describe('computeMoveRenames', () => {
  it('moves a tour to a target folder', () => {
    const tours = [makeTour('A / Tour1', 1)];
    const tree = buildTree(tours);
    const selected = makeSelected([{ type: 'tour', path: 'A', tourId: 1 }]);
    const renames = computeMoveRenames(selected, 'C/D', tree);
    expect(renames).toHaveLength(1);
    expect(renames[0].newName).toBe('C / D / Tour1');
  });

  it('moves a folder preserving internal structure', () => {
    const tours = [
      makeTour('A / B / Tour1', 1),
      makeTour('A / B / Sub / Tour2', 2),
    ];
    const tree = buildTree(tours);
    const selected = makeSelected([{ type: 'folder', path: 'A/B' }]);
    const renames = computeMoveRenames(selected, 'X', tree);
    expect(renames).toHaveLength(2);
    expect(renames.find((r) => r.tourId === 1)!.newName).toBe('X / B / Tour1');
    expect(renames.find((r) => r.tourId === 2)!.newName).toBe(
      'X / B / Sub / Tour2',
    );
  });

  it('moves to root (empty path)', () => {
    const tours = [makeTour('A / B / Tour1', 1)];
    const tree = buildTree(tours);
    const selected = makeSelected([{ type: 'folder', path: 'A/B' }]);
    const renames = computeMoveRenames(selected, '', tree);
    expect(renames).toHaveLength(1);
    expect(renames[0].newName).toBe('B / Tour1');
  });
});
