export interface RouteState {
  view: 'folder' | 'tour' | 'none';
  path: string;
  tourId: number | null;
}

/** Parse the current hash into a route state. */
export function parseHash(): RouteState {
  const hash = window.location.hash.slice(1); // Remove '#'
  if (!hash || hash === '/') {
    return { view: 'none', path: '', tourId: null };
  }

  if (hash.startsWith('/tour/')) {
    const id = parseInt(hash.slice(6), 10);
    if (!isNaN(id)) {
      return { view: 'tour', path: '', tourId: id };
    }
  }

  if (hash.startsWith('/folder/')) {
    const path = decodeURIComponent(hash.slice(8));
    return { view: 'folder', path, tourId: null };
  }

  return { view: 'none', path: '', tourId: null };
}

/** Set the hash for a folder view. */
export function setFolderHash(path: string): void {
  const newHash = path ? `#/folder/${encodeURIComponent(path)}` : '#/';
  if (window.location.hash !== newHash) {
    history.pushState(null, '', newHash);
  }
}

/** Set the hash for a tour view. */
export function setTourHash(tourId: number): void {
  const newHash = `#/tour/${tourId}`;
  if (window.location.hash !== newHash) {
    history.pushState(null, '', newHash);
  }
}

/** Clear the hash. */
export function clearHash(): void {
  if (window.location.hash) {
    history.pushState(null, '', '#/');
  }
}
