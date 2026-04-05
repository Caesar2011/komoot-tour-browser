const DB_NAME = 'komoot-tour-browser';
const DB_VERSION = 2;
const STORE = 'cache';
const STORE_CN = 'custom_names';
const STORE_META = 'meta';

interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

export interface CustomNameRecord {
  tourId: number;
  name: string;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      // v1 store
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      // v2 stores
      if (!db.objectStoreNames.contains(STORE_CN)) {
        db.createObjectStore(STORE_CN, { keyPath: 'tourId' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
      void e;
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
  key: IDBValidKey,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut<T>(
  store: IDBObjectStore,
  value: T,
  key?: IDBValidKey,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = key !== undefined ? store.put(value, key) : store.put(value);
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

function idbGetAllValues<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ── generic cache helpers ──────────────────────────────────────────────────

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
    const entry = await idbGet<CacheEntry<T[]>>(store, listKey);
    if (!entry) return;
    const updated = entry.value.map((t) =>
      t.id === tourId ? { ...t, ...fields } : t,
    );
    await idbPut(store, { value: updated, cachedAt: entry.cachedAt }, listKey);
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
    const entry = await idbGet<CacheEntry<T[]>>(store, listKey);
    if (!entry) return;
    const updated = entry.value.filter((t) => t.id !== tourId);
    await idbPut(store, { value: updated, cachedAt: entry.cachedAt }, listKey);
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
    const entry = await idbGet<CacheEntry<T[]>>(store, listKey);
    if (!entry) return;
    const updated = [tour, ...entry.value.filter((t) => t.id !== tour.id)];
    await idbPut(store, { value: updated, cachedAt: entry.cachedAt }, listKey);
  } catch {
    // ignore
  }
}

// ── custom_names store helpers ─────────────────────────────────────────────

/** Return all custom name records. */
export async function cnGetAll(): Promise<CustomNameRecord[]> {
  try {
    const db = await getDb();
    const store = db.transaction(STORE_CN, 'readonly').objectStore(STORE_CN);
    return await idbGetAllValues<CustomNameRecord>(store);
  } catch {
    return [];
  }
}

/** Upsert a custom name record. */
export async function cnPut(record: CustomNameRecord): Promise<void> {
  try {
    const db = await getDb();
    const store = db.transaction(STORE_CN, 'readwrite').objectStore(STORE_CN);
    await idbPut(store, record);
  } catch {
    // ignore
  }
}

/** Delete a custom name record by tourId. */
export async function cnDelete(tourId: number): Promise<void> {
  try {
    const db = await getDb();
    const store = db.transaction(STORE_CN, 'readwrite').objectStore(STORE_CN);
    await idbDelete(store, tourId);
  } catch {
    // ignore
  }
}

// ── meta store helpers ─────────────────────────────────────────────────────

/** Read a value from the meta store. */
export async function metaGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await getDb();
    const store = db
      .transaction(STORE_META, 'readonly')
      .objectStore(STORE_META);
    return await idbGet<T>(store, key);
  } catch {
    return undefined;
  }
}

/** Write a value to the meta store. */
export async function metaPut<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDb();
    const store = db
      .transaction(STORE_META, 'readwrite')
      .objectStore(STORE_META);
    await idbPut(store, value, key);
  } catch {
    // ignore
  }
}
