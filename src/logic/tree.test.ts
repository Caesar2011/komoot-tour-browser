import { describe, expect, it } from 'vitest';

import type { Tour } from '../types.ts';

import { buildTree, collectTours, countTours, findNode, flattenTree } from './tree.ts';

function makeTour(name: string, id = 1): Tour {
  return {
    id,
    name,
    sport: 'hike',
    type: 'tour_recorded',
    distance: 1000,
    duration: 600,
  };
}

describe('buildTree', () => {
  it('places flat tours at root', () => {
    const tree = buildTree([makeTour('My Hike', 1)]);
    expect(tree.tours).toHaveLength(1);
    expect(tree.children.size).toBe(0);
  });

  it('creates nested folders from slash-separated names', () => {
    const tree = buildTree([makeTour('Alps / Tyrol / Summit Hike', 1)]);
    expect(tree.tours).toHaveLength(0);
    expect(tree.children.has('Alps')).toBe(true);
    const alps = tree.children.get('Alps')!;
    expect(alps.children.has('Tyrol')).toBe(true);
    expect(alps.children.get('Tyrol')!.tours).toHaveLength(1);
  });
});

describe('countTours', () => {
  it('counts all tours recursively', () => {
    const tree = buildTree([
      makeTour('A', 1),
      makeTour('Folder / B', 2),
      makeTour('Folder / Sub / C', 3),
    ]);
    expect(countTours(tree)).toBe(3);
  });
});

describe('collectTours', () => {
  it('collects all tours recursively', () => {
    const tree = buildTree([makeTour('A', 1), makeTour('F / B', 2)]);
    expect(collectTours(tree)).toHaveLength(2);
  });
});

describe('findNode', () => {
  it('finds root with empty path', () => {
    const tree = buildTree([]);
    expect(findNode(tree, '')).toBe(tree);
  });

  it('finds nested folder', () => {
    const tree = buildTree([makeTour('A / B / Tour', 1)]);
    const node = findNode(tree, 'A/B');
    expect(node).not.toBeNull();
    expect(node!.name).toBe('B');
  });

  it('returns null for missing path', () => {
    const tree = buildTree([]);
    expect(findNode(tree, 'nonexistent')).toBeNull();
  });
});

describe('flattenTree', () => {
  it('returns only root when nothing is open', () => {
    const tree = buildTree([makeTour('Folder / A', 1), makeTour('B', 2)]);
    const items = flattenTree(tree, new Set());
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('folder');
    expect(items[0].path).toBe('');
  });

  it('returns root + children when root is open', () => {
    const tree = buildTree([makeTour('Folder / A', 1), makeTour('B', 2)]);
    const items = flattenTree(tree, new Set(['']));
    // root folder + "Folder" folder (closed) + tour B
    expect(items.length).toBe(3);
    expect(items[0].type).toBe('folder'); // root
    expect(items[1].type).toBe('folder'); // Folder
    expect(items[2].type).toBe('tour');   // B
  });

  it('includes nested items when subfolder is open', () => {
    const tree = buildTree([makeTour('Folder / A', 1), makeTour('B', 2)]);
    const items = flattenTree(tree, new Set(['', 'Folder']));
    // root + Folder + tour A + tour B
    expect(items.length).toBe(4);
    expect(items[2].type).toBe('tour');
    expect(items[2].tour!.id).toBe(1);
  });

  it('deeply nested items appear in correct order', () => {
    const tree = buildTree([
      makeTour('A / B / Tour1', 1),
      makeTour('A / Tour2', 2),
    ]);
    const items = flattenTree(tree, new Set(['', 'A', 'A/B']));
    const types = items.map((i) => (i.type === 'tour' ? `tour:${i.tour!.id}` : `folder:${i.path}`));
    expect(types).toEqual([
      'folder:',
      'folder:A',
      'folder:A/B',
      'tour:1',
      'tour:2',
    ]);
  });
});
