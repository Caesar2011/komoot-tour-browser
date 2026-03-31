import type { Filters, Tour } from '../types.ts';

/** Apply all filters and sorting to a tour list entirely client-side. */
export function applyFilters(tours: Tour[], filters: Filters): Tour[] {
  let result = tours;

  // Type filter
  if (filters.type) {
    result = result.filter((t) => t.type === filters.type);
  }

  // Status filter (union of selected statuses; none selected = show all)
  const { statusPublic, statusPrivate, statusFriends } = filters;
  if (statusPublic || statusPrivate || statusFriends) {
    const allowed = new Set<string>();
    if (statusPublic) allowed.add('public');
    if (statusPrivate) allowed.add('private');
    if (statusFriends) allowed.add('friends');
    result = result.filter((t) => t.status && allowed.has(t.status));
  }

  // Date range
  if (filters.startDate) {
    const start = filters.startDate;
    result = result.filter((t) => (t.date ?? '') >= start);
  }
  if (filters.endDate) {
    const end = filters.endDate + '\uffff';
    result = result.filter((t) => (t.date ?? '') <= end);
  }

  // Name search
  const q = filters.nameQuery.toLowerCase().trim();
  if (q) {
    result = result.filter((t) => (t.name || '').toLowerCase().includes(q));
  }

  // Sort
  result = sortTours(result, filters.sortField, filters.sortDirection);

  return result;
}

function sortTours(tours: Tour[], field: string, dir: string): Tour[] {
  const sorted = [...tours];
  const mult = dir === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (field) {
      case 'name':
        return mult * (a.name || '').localeCompare(b.name || '');
      case 'distance':
        return mult * (a.distance - b.distance);
      case 'elevation':
        return mult * ((a.elevation_up ?? 0) - (b.elevation_up ?? 0));
      case 'duration':
        return mult * (a.duration - b.duration);
      case 'date':
      default:
        return mult * (a.date || '').localeCompare(b.date || '');
    }
  });

  return sorted;
}
