const DB_NAME = 'komoot-tour-browser';
const DB_VERSION = 1;
const STORE = 'cache';

interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

function idbGet<T>(
  store: IDBObjectStore,
  key: string,
): Promise<CacheEntry<T> | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as CacheEntry<T> | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut<T>(
  store: IDBObjectStore,
  key: string,
  entry: CacheEntry<T>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.put(entry, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(store: IDBObjectStore, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function cacheGet<T>(
  key: string,
  ttlMs: number,
): Promise<T | null> {
  try {
    const db = await getDb();
    const entry = await new Promise<CacheEntry<T> | undefined>(
      (resolve, reject) => {
        const req = db
          .transaction(STORE, 'readonly')
          .objectStore(STORE)
          .get(key);
        req.onsuccess = () => resolve(req.result as CacheEntry<T> | undefined);
        req.onerror = () => reject(req.error);
      },
    );
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ttlMs) {
      cacheDelete(key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDb();
    const entry: CacheEntry<T> = { value, cachedAt: Date.now() };
    await new Promise<void>((resolve, reject) => {
      const req = db
        .transaction(STORE, 'readwrite')
        .objectStore(STORE)
        .put(entry, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Cache failures are non-fatal
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const req = db
        .transaction(STORE, 'readwrite')
        .objectStore(STORE)
        .delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

/** Delete all keys matching a prefix (e.g. all detail data for a tour). */
export async function cacheDeletePrefix(prefix: string): Promise<void> {
  try {
    const db = await getDb();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const req = db
        .transaction(STORE, 'readonly')
        .objectStore(STORE)
        .getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const matching = (keys as string[]).filter((k) => k.startsWith(prefix));
    if (matching.length === 0) return;
    const db2 = await getDb();
    const store = db2.transaction(STORE, 'readwrite').objectStore(STORE);
    await Promise.all(matching.map((k) => idbDelete(store, k)));
  } catch {
    // ignore
  }
}

/**
 * Update fields of a single tour inside a cached tour list in-place.
 * Preserves the original `cachedAt` timestamp so the list TTL is unchanged.
 */
export async function cachePatchTour<T extends { id: number }>(
  listKey: string,
  tourId: number,
  fields: Partial<T>,
): Promise<void> {
  try {
    const db = await getDb();
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const entry = await idbGet<T[]>(store, listKey);
    if (!entry) return;
    const updated = entry.value.map((t) =>
      t.id === tourId ? { ...t, ...fields } : t,
    );
    await idbPut(store, listKey, { value: updated, cachedAt: entry.cachedAt });
  } catch {
    // ignore
  }
}

/**
 * Remove a tour by id from a cached tour list in-place.
 * Preserves the original `cachedAt` timestamp.
 */
export async function cacheRemoveTour<T extends { id: number }>(
  listKey: string,
  tourId: number,
): Promise<void> {
  try {
    const db = await getDb();
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const entry = await idbGet<T[]>(store, listKey);
    if (!entry) return;
    const updated = entry.value.filter((t) => t.id !== tourId);
    await idbPut(store, listKey, { value: updated, cachedAt: entry.cachedAt });
  } catch {
    // ignore
  }
}

/**
 * Prepend a tour to a cached tour list in-place.
 * Preserves the original `cachedAt` timestamp.
 */
export async function cachePrependTour<T extends { id: number }>(
  listKey: string,
  tour: T,
): Promise<void> {
  try {
    const db = await getDb();
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const entry = await idbGet<T[]>(store, listKey);
    if (!entry) return;
    const updated = [tour, ...entry.value.filter((t) => t.id !== tour.id)];
    await idbPut(store, listKey, { value: updated, cachedAt: entry.cachedAt });
  } catch {
    // ignore
  }
}
