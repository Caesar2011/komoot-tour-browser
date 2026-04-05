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

/** Simple LRU map with a max capacity. Evicts least-recently-used on set. */
export class LruMap<K, V> {
  private map = new Map<K, V>();
  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    const val = this.map.get(key);
    if (val === undefined) return undefined;
    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      // Delete the first (oldest) entry
      const firstKey = this.map.keys().next().value!;
      this.map.delete(firstKey);
    }
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  delete(key: K): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains(STORE_CN)) {
        db.createObjectStore(STORE_CN, { keyPath: 'tourId' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
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

function idbGetAllValues<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

/** Wait for an IDB transaction to complete. */
function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
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
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry, key);
    await txComplete(tx);
  } catch {
    // Cache failures are non-fatal
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    await txComplete(tx);
  } catch {
    // ignore
  }
}

/** Delete all keys matching a prefix in a single transaction. */
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
    // Single readwrite transaction for all deletes
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const k of matching) store.delete(k);
    await txComplete(tx);
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
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const entry = await idbGet<CacheEntry<T[]>>(store, listKey);
    if (!entry) return;
    const updated = entry.value.map((t) =>
      t.id === tourId ? { ...t, ...fields } : t,
    );
    await idbPut(store, { value: updated, cachedAt: entry.cachedAt }, listKey);
    await txComplete(tx);
  } catch {
    // ignore
  }
}

/**
 * Remove a tour by id from a cached tour list in-place.
 */
export async function cacheRemoveTour<T extends { id: number }>(
  listKey: string,
  tourId: number,
): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const entry = await idbGet<CacheEntry<T[]>>(store, listKey);
    if (!entry) return;
    const updated = entry.value.filter((t) => t.id !== tourId);
    await idbPut(store, { value: updated, cachedAt: entry.cachedAt }, listKey);
    await txComplete(tx);
  } catch {
    // ignore
  }
}

/**
 * Prepend a tour to a cached tour list in-place.
 */
export async function cachePrependTour<T extends { id: number }>(
  listKey: string,
  tour: T,
): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const entry = await idbGet<CacheEntry<T[]>>(store, listKey);
    if (!entry) return;
    const updated = [tour, ...entry.value.filter((t) => t.id !== tour.id)];
    await idbPut(store, { value: updated, cachedAt: entry.cachedAt }, listKey);
    await txComplete(tx);
  } catch {
    // ignore
  }
}

// ── custom_names store helpers ─────────────────────────────────────────────

export async function cnGetAll(): Promise<CustomNameRecord[]> {
  try {
    const db = await getDb();
    const store = db.transaction(STORE_CN, 'readonly').objectStore(STORE_CN);
    return await idbGetAllValues<CustomNameRecord>(store);
  } catch {
    return [];
  }
}

export async function cnPut(record: CustomNameRecord): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_CN, 'readwrite');
    await idbPut(tx.objectStore(STORE_CN), record);
    await txComplete(tx);
  } catch {
    // ignore
  }
}

export async function cnDelete(tourId: number): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_CN, 'readwrite');
    tx.objectStore(STORE_CN).delete(tourId);
    await txComplete(tx);
  } catch {
    // ignore
  }
}

// ── meta store helpers ─────────────────────────────────────────────────────

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

export async function metaPut<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_META, 'readwrite');
    await idbPut(tx.objectStore(STORE_META), value, key);
    await txComplete(tx);
  } catch {
    // ignore
  }
}
