import type {
  AuthState,
  Coordinate,
  CoordinatesApiResponse,
  CoverImage,
  LoginApiResponse,
  SurfaceSegment,
  TimelineEntry,
  Tour,
  TourStatus,
  ToursApiResponse,
  WayTypeSegment,
} from '../types.ts';
import { CONFIG } from '../config.ts';

import {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePrefix,
  cachePatchTour,
  cacheRemoveTour,
  cachePrependTour,
} from './cache.ts';
import { basicAuthHeader } from './utils.ts';

export class AuthExpiredError extends Error {
  constructor() {
    super('AUTH_EXPIRED');
    this.name = 'AuthExpiredError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export interface IApiClient {
  readonly isAuthenticated: boolean;
  readonly displayName: string;
  readonly userId: string;
  login(email: string, password: string): Promise<AuthState>;
  restoreAuth(): boolean;
  clearAuth(): void;
  fetchAllTours(signal?: AbortSignal): Promise<Tour[]>;
  fetchCoordinates(
    tourId: number,
    signal?: AbortSignal,
  ): Promise<Coordinate[] | null>;
  hasCachedCoordinates(tourId: number): boolean;
  getCachedCoordinates(tourId: number): Coordinate[] | null;
  renameTour(tourId: number, newName: string): Promise<Tour>;
  patchTour(
    tourId: number,
    fields: Partial<{ name: string; sport: string; status: TourStatus }>,
  ): Promise<Tour>;
  uploadTour(
    file: File,
    dataType: string,
    options: { name?: string; sport?: string; status?: TourStatus },
  ): Promise<Tour>;
  deleteTour(tourId: number): Promise<void>;
  downloadGpx(tourId: number): Promise<Blob>;
  downloadFit(tourId: number): Promise<Blob>;
  fetchTimeline(tourId: number, signal?: AbortSignal): Promise<TimelineEntry[]>;
  fetchCoverImages(tourId: number, signal?: AbortSignal): Promise<CoverImage[]>;
  fetchWayTypes(
    tourId: number,
    signal?: AbortSignal,
  ): Promise<WayTypeSegment[]>;
  fetchSurfaces(
    tourId: number,
    signal?: AbortSignal,
  ): Promise<SurfaceSegment[]>;
  /** Remove all persistent + in-memory detail cache entries for one tour. */
  invalidateTourCache(tourId: number): Promise<void>;
  /** Remove the cached tour list so the next fetch hits the network. */
  invalidateToursCache(): Promise<void>;
  resetCaches(): void;
}

class ApiClient implements IApiClient {
  private auth: AuthState | null = null;

  /** In-memory mirror — avoids redundant IDB reads within a session. */
  private memCoords = new Map<number, Coordinate[]>();
  private memCovers = new Map<number, CoverImage[]>();

  // ── key helpers ────────────────────────────────────────────────────────────

  private toursKey(): string {
    return `tours:${this.auth!.userId}`;
  }

  // ── auth ───────────────────────────────────────────────────────────────────

  get isAuthenticated(): boolean {
    return !!(this.auth && this.auth.userId && this.auth.token);
  }

  get displayName(): string {
    return this.auth?.displayName ?? '';
  }

  get userId(): string {
    return this.auth?.userId ?? '';
  }

  private headers(): Record<string, string> {
    if (!this.isAuthenticated || !this.auth)
      throw new Error('Not authenticated');
    return {
      Authorization: basicAuthHeader(this.auth.userId, this.auth.token),
    };
  }

  private async get(url: string, signal?: AbortSignal): Promise<Response> {
    const resp = await fetch(url, { headers: this.headers(), signal });
    if (resp.status === 401 || resp.status === 403) {
      this.clearAuth();
      throw new AuthExpiredError();
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp;
  }

  async login(email: string, password: string): Promise<AuthState> {
    const url = `${CONFIG.API_BASE}/v006/account/email/${encodeURIComponent(email)}/`;
    const resp = await fetch(url, {
      headers: { Authorization: basicAuthHeader(email, password) },
    });
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403)
        throw new Error('Invalid email or password.');
      throw new Error(`Login failed (HTTP ${resp.status}).`);
    }
    const data: LoginApiResponse = await resp.json();
    this.auth = {
      userId: data.username,
      token: data.password,
      displayName: data.user?.displayname ?? data.username,
    };
    sessionStorage.setItem('komoot_auth', JSON.stringify(this.auth));
    return this.auth;
  }

  restoreAuth(): boolean {
    try {
      const raw = sessionStorage.getItem('komoot_auth');
      if (!raw) return false;
      const p = JSON.parse(raw) as AuthState;
      if (p?.userId && p?.token) {
        this.auth = p;
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  clearAuth(): void {
    this.auth = null;
    sessionStorage.removeItem('komoot_auth');
  }

  // ── tours list ─────────────────────────────────────────────────────────────

  async fetchAllTours(signal?: AbortSignal): Promise<Tour[]> {
    // Try persistent cache first
    const cached = await cacheGet<Tour[]>(this.toursKey(), CONFIG.CACHE_TTL_MS);
    if (cached) return cached;

    // Network fetch (paginated)
    const tours: Tour[] = [];
    let page = 0;
    for (;;) {
      const url = `${CONFIG.API_BASE}/v007/users/${this.auth!.userId}/tours/?limit=${CONFIG.PAGE_LIMIT}&page=${page}`;
      const resp = await this.get(url, signal);
      const data: ToursApiResponse = await resp.json();
      const pageTours: Tour[] = data._embedded?.tours ?? [];
      tours.push(...pageTours);
      const totalPages: number = data.page?.totalPages ?? 1;
      page++;
      if (page >= totalPages || pageTours.length === 0) break;
    }

    await cacheSet(this.toursKey(), tours);
    return tours;
  }

  async invalidateToursCache(): Promise<void> {
    await cacheDelete(this.toursKey());
  }

  // ── coordinates ────────────────────────────────────────────────────────────

  async fetchCoordinates(
    tourId: number,
    signal?: AbortSignal,
  ): Promise<Coordinate[] | null> {
    const mem = this.memCoords.get(tourId);
    if (mem) return mem;

    const cached = await cacheGet<Coordinate[]>(
      `coords:${tourId}`,
      CONFIG.CACHE_TTL_MS,
    );
    if (cached) {
      this.memCoords.set(tourId, cached);
      return cached;
    }

    try {
      const resp = await this.get(
        `${CONFIG.API_BASE}/v007/tours/${tourId}/coordinates`,
        signal,
      );
      const data: CoordinatesApiResponse = await resp.json();
      const coords: Coordinate[] = data.items ?? [];
      this.memCoords.set(tourId, coords);
      await cacheSet(`coords:${tourId}`, coords);
      return coords;
    } catch (err) {
      if (err instanceof AuthExpiredError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      return null;
    }
  }

  hasCachedCoordinates(tourId: number): boolean {
    return this.memCoords.has(tourId);
  }

  getCachedCoordinates(tourId: number): Coordinate[] | null {
    return this.memCoords.get(tourId) ?? null;
  }

  // ── mutations ──────────────────────────────────────────────────────────────

  async patchTour(
    tourId: number,
    fields: Partial<{ name: string; sport: string; status: TourStatus }>,
  ): Promise<Tour> {
    if (!this.isAuthenticated) throw new Error('Not authenticated');
    const url = `${CONFIG.API_WWW}/v007/tours/${tourId}?hl=${CONFIG.LOCALE}`;
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (resp.status === 401) {
      this.clearAuth();
      throw new AuthExpiredError();
    }
    if (resp.status === 403) {
      throw new ForbiddenError(
        'You do not have permission to modify this tour.',
      );
    }
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`;
      try {
        const e = await resp.json();
        msg = e.message || msg;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const tour = (await resp.json()) as Tour;
    // Keep the cached list consistent
    await cachePatchTour<Tour>(this.toursKey(), tourId, fields);
    return tour;
  }

  async renameTour(tourId: number, newName: string): Promise<Tour> {
    return this.patchTour(tourId, { name: newName });
  }

  async deleteTour(tourId: number): Promise<void> {
    if (!this.isAuthenticated) throw new Error('Not authenticated');
    const url = `${CONFIG.API_WWW}/v007/tours/${tourId}?hl=${CONFIG.LOCALE}`;
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (resp.status === 401) {
      this.clearAuth();
      throw new AuthExpiredError();
    }
    if (resp.status === 403) {
      throw new ForbiddenError(
        'You do not have permission to delete this tour.',
      );
    }
    if (!resp.ok && resp.status !== 204) {
      throw new Error(`HTTP ${resp.status}`);
    }
    // Remove from list cache and clear all detail caches
    await Promise.all([
      cacheRemoveTour<Tour>(this.toursKey(), tourId),
      this.invalidateTourCache(tourId),
    ]);
  }

  async uploadTour(
    file: File,
    dataType: string,
    options: { name?: string; sport?: string; status?: TourStatus },
  ): Promise<Tour> {
    if (!this.isAuthenticated) throw new Error('Not authenticated');
    let url = `${CONFIG.API_BASE}/v007/tours/?data_type=${encodeURIComponent(dataType)}`;
    if (options.name) url += `&name=${encodeURIComponent(options.name)}`;
    if (options.sport) url += `&sport=${encodeURIComponent(options.sport)}`;
    if (options.status) url += `&status=${encodeURIComponent(options.status)}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/octet-stream',
        'User-Agent': 'komoot-tour-browser/1.0',
      },
      body: file,
    });
    if (resp.status === 401) {
      this.clearAuth();
      throw new AuthExpiredError();
    }
    if (!resp.ok && resp.status !== 201 && resp.status !== 202) {
      let msg = `HTTP ${resp.status}`;
      try {
        const e = await resp.json();
        msg = e.message || msg;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const tour = (await resp.json()) as Tour;
    // Prepend to cached list if one exists
    await cachePrependTour<Tour>(this.toursKey(), tour);
    return tour;
  }

  // ── downloads ──────────────────────────────────────────────────────────────

  async downloadGpx(tourId: number): Promise<Blob> {
    const resp = await this.get(`${CONFIG.API_BASE}/v007/tours/${tourId}.gpx`);
    return resp.blob();
  }

  async downloadFit(tourId: number): Promise<Blob> {
    const resp = await this.get(`${CONFIG.API_BASE}/v007/tours/${tourId}.fit`);
    return resp.blob();
  }

  // ── detail fetches ─────────────────────────────────────────────────────────

  async fetchTimeline(
    tourId: number,
    signal?: AbortSignal,
  ): Promise<TimelineEntry[]> {
    const key = `timeline:${tourId}`;
    const cached = await cacheGet<TimelineEntry[]>(key, CONFIG.CACHE_TTL_MS);
    if (cached) return cached;
    try {
      const resp = await this.get(
        `${CONFIG.API_BASE}/v007/tours/${tourId}/timeline/`,
        signal,
      );
      const data = await resp.json();
      const items: TimelineEntry[] = data._embedded?.items ?? [];
      await cacheSet(key, items);
      return items;
    } catch (err) {
      if (err instanceof AuthExpiredError) throw err;
      return [];
    }
  }

  async fetchCoverImages(
    tourId: number,
    signal?: AbortSignal,
  ): Promise<CoverImage[]> {
    const mem = this.memCovers.get(tourId);
    if (mem) return mem;

    const key = `covers:${tourId}`;
    const cached = await cacheGet<CoverImage[]>(key, CONFIG.CACHE_TTL_MS);
    if (cached) {
      this.memCovers.set(tourId, cached);
      return cached;
    }
    try {
      const resp = await this.get(
        `${CONFIG.API_BASE}/v007/tours/${tourId}/cover_images/`,
        signal,
      );
      const data = await resp.json();
      const images: CoverImage[] = data._embedded?.items ?? data.items ?? [];
      this.memCovers.set(tourId, images);
      await cacheSet(key, images);
      return images;
    } catch (err) {
      if (err instanceof AuthExpiredError) throw err;
      return [];
    }
  }

  async fetchWayTypes(
    tourId: number,
    signal?: AbortSignal,
  ): Promise<WayTypeSegment[]> {
    const key = `waytypes:${tourId}`;
    const cached = await cacheGet<WayTypeSegment[]>(key, CONFIG.CACHE_TTL_MS);
    if (cached) return cached;
    try {
      const resp = await this.get(
        `${CONFIG.API_BASE}/v007/tours/${tourId}/way_types`,
        signal,
      );
      const data = await resp.json();
      const items: WayTypeSegment[] = data.items ?? [];
      await cacheSet(key, items);
      return items;
    } catch {
      return [];
    }
  }

  async fetchSurfaces(
    tourId: number,
    signal?: AbortSignal,
  ): Promise<SurfaceSegment[]> {
    const key = `surfaces:${tourId}`;
    const cached = await cacheGet<SurfaceSegment[]>(key, CONFIG.CACHE_TTL_MS);
    if (cached) return cached;
    try {
      const resp = await this.get(
        `${CONFIG.API_BASE}/v007/tours/${tourId}/surfaces`,
        signal,
      );
      const data = await resp.json();
      const items: SurfaceSegment[] = data.items ?? [];
      await cacheSet(key, items);
      return items;
    } catch {
      return [];
    }
  }

  // ── cache management ───────────────────────────────────────────────────────

  async invalidateTourCache(tourId: number): Promise<void> {
    this.memCoords.delete(tourId);
    this.memCovers.delete(tourId);
    await Promise.all([
      cacheDeletePrefix(`coords:${tourId}`),
      cacheDeletePrefix(`covers:${tourId}`),
      cacheDeletePrefix(`timeline:${tourId}`),
      cacheDeletePrefix(`waytypes:${tourId}`),
      cacheDeletePrefix(`surfaces:${tourId}`),
    ]);
  }

  resetCaches(): void {
    this.memCoords.clear();
    this.memCovers.clear();
    // Intentionally does not clear IDB — persistent cache survives session resets.
  }
}

export const Api: IApiClient = new ApiClient();
