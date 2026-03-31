import type { SidebarItem, Tour, TreeNode } from '../types.ts';

export function buildTree(tours: Tour[]): TreeNode {
  const root: TreeNode = {
    name: 'All Tours',
    path: '',
    children: new Map(),
    tours: [],
  };

  for (const tour of tours) {
    const parts = (tour.name || 'Unnamed')
      .split(' / ')
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length <= 1) {
      root.tours.push(tour);
      continue;
    }

    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!node.children.has(seg)) {
        node.children.set(seg, {
          name: seg,
          path: node.path ? node.path + '/' + seg : seg,
          children: new Map(),
          tours: [],
        });
      }
      node = node.children.get(seg)!;
    }

    const enriched: Tour = { ...tour, _leafName: parts[parts.length - 1] };
    node.tours.push(enriched);
  }
  return root;
}

export function countTours(node: TreeNode): number {
  let c = node.tours.length;
  for (const ch of node.children.values()) c += countTours(ch);
  return c;
}

export function collectTours(node: TreeNode): Tour[] {
  const result = [...node.tours];
  for (const ch of node.children.values()) result.push(...collectTours(ch));
  return result;
}

export function findNode(root: TreeNode, path: string): TreeNode | null {
  if (!path) return root;
  let node = root;
  for (const p of path.split('/')) {
    if (!node.children.has(p)) return null;
    node = node.children.get(p)!;
  }
  return node;
}

/**
 * Flatten the tree into an ordered list of sidebar items for keyboard navigation.
 * Only includes items that are currently visible (i.e. parent folders are open).
 */
export function flattenTree(
  node: TreeNode,
  openPaths: Set<string>,
  depth: number = 0,
): SidebarItem[] {
  const items: SidebarItem[] = [];

  // The folder item itself
  items.push({ type: 'folder', path: node.path, depth });

  const isOpen = openPaths.has(node.path);
  if (!isOpen) return items;

  const childKeys = [...node.children.keys()].sort((a, b) =>
    a.localeCompare(b),
  );

  for (const key of childKeys) {
    items.push(...flattenTree(node.children.get(key)!, openPaths, depth + 1));
  }

  for (const tour of node.tours) {
    items.push({ type: 'tour', path: node.path, tour, depth: depth + 1 });
  }

  return items;
}
