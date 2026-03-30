import type {
  AuthState,
  Coordinate,
  CoordinatesApiResponse,
  CoverImage,
  LoginApiResponse,
  ServerFilters,
  SurfaceSegment,
  TimelineEntry,
  Tour,
  TourStatus,
  ToursApiResponse,
  WayTypeSegment,
} from '../types.ts';
import { CONFIG } from '../config.ts';
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
  fetchAllTours(signal?: AbortSignal, filters?: ServerFilters): Promise<Tour[]>;
  fetchCoordinates(tourId: number, signal?: AbortSignal): Promise<Coordinate[] | null>;
  hasCachedCoordinates(tourId: number): boolean;
  getCachedCoordinates(tourId: number): Coordinate[] | null;
  renameTour(tourId: number, newName: string): Promise<Tour>;
  patchTour(tourId: number, fields: Partial<{ name: string; sport: string; status: TourStatus }>): Promise<Tour>;
  uploadTour(file: File, dataType: string, options: { name?: string; sport?: string; status?: TourStatus }): Promise<Tour>;
  downloadGpx(tourId: number): Promise<Blob>;
  downloadFit(tourId: number): Promise<Blob>;
  fetchTimeline(tourId: number, signal?: AbortSignal): Promise<TimelineEntry[]>;
  fetchCoverImages(tourId: number, signal?: AbortSignal): Promise<CoverImage[]>;
  fetchWayTypes(tourId: number, signal?: AbortSignal): Promise<WayTypeSegment[]>;
  fetchSurfaces(tourId: number, signal?: AbortSignal): Promise<SurfaceSegment[]>;
  resetCaches(): void;
}

class ApiClient implements IApiClient {
  private auth: AuthState | null = null;
  private coordsCache = new Map<number, Coordinate[]>();
  private coverImageCache = new Map<number, CoverImage[]>();

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

  async fetchAllTours(signal?: AbortSignal, filters?: ServerFilters): Promise<Tour[]> {
    const tours: Tour[] = [];
    let page = 0;
    for (;;) {
      let url = `${CONFIG.API_BASE}/v007/users/${this.auth!.userId}/tours/?limit=${CONFIG.PAGE_LIMIT}&page=${page}`;
      if (filters) {
        if (filters.type) url += `&type=${filters.type}`;
        if (filters.startDate) {
          url += `&start_date=${encodeURIComponent(new Date(filters.startDate + 'T00:00:00.000Z').toISOString())}`;
        }
        if (filters.endDate) {
          url += `&end_date=${encodeURIComponent(new Date(filters.endDate + 'T23:59:59.999Z').toISOString())}`;
        }
        if (filters.sortField) url += `&sort_field=${filters.sortField}`;
        if (filters.sortDirection) url += `&sort_direction=${filters.sortDirection}`;
      }
      const resp = await this.get(url, signal);
      const data: ToursApiResponse = await resp.json();
      const pageTours: Tour[] = data._embedded?.tours ?? [];
      tours.push(...pageTours);
      const totalPages: number = data.page?.totalPages ?? 1;
      page++;
      if (page >= totalPages || pageTours.length === 0) break;
    }

    // Status is NOT a server-side filter — always apply client-side
    if (filters) {
      const { statusPublic, statusPrivate, statusFriends } = filters;
      const anyActive = statusPublic || statusPrivate || statusFriends;
      if (anyActive) {
        const allowed = new Set<string>();
        if (statusPublic) allowed.add('public');
        if (statusPrivate) allowed.add('private');
        if (statusFriends) allowed.add('friends');
        return tours.filter((t) => t.status && allowed.has(t.status));
      }
    }

    return tours;
  }

  async fetchCoordinates(tourId: number, signal?: AbortSignal): Promise<Coordinate[] | null> {
    const cached = this.coordsCache.get(tourId);
    if (cached) return cached;
    try {
      const resp = await this.get(
        `${CONFIG.API_BASE}/v007/tours/${tourId}/coordinates`,
        signal,
      );
      const data: CoordinatesApiResponse = await resp.json();
      const coords: Coordinate[] = data.items ?? [];
      this.coordsCache.set(tourId, coords);
      return coords;
    } catch (err) {
      if (err instanceof AuthExpiredError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      return null;
    }
  }

  hasCachedCoordinates(tourId: number): boolean {
    return this.coordsCache.has(tourId);
  }

  getCachedCoordinates(tourId: number): Coordinate[] | null {
    return this.coordsCache.get(tourId) ?? null;
  }

  async patchTour(
    tourId: number,
    fields: Partial<{ name: string; sport: string; status: TourStatus }>,
  ): Promise<Tour> {
    if (!this.isAuthenticated) throw new Error('Not authenticated');
    const url = `${CONFIG.API_WWW}/v007/tours/${tourId}?hl=${CONFIG.LOCALE}`;
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fields),
    });
    if (resp.status === 401) {
      this.clearAuth();
      throw new AuthExpiredError();
    }
    if (resp.status === 403) {
      throw new ForbiddenError('You do not have permission to modify this tour.');
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
    return (await resp.json()) as Tour;
  }

  async renameTour(tourId: number, newName: string): Promise<Tour> {
    return this.patchTour(tourId, { name: newName });
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
    return (await resp.json()) as Tour;
  }

  async downloadGpx(tourId: number): Promise<Blob> {
    const resp = await this.get(`${CONFIG.API_BASE}/v007/tours/${tourId}.gpx`);
    return resp.blob();
  }

  async downloadFit(tourId: number): Promise<Blob> {
    const resp = await this.get(`${CONFIG.API_BASE}/v007/tours/${tourId}.fit`);
    return resp.blob();
  }

  async fetchTimeline(tourId: number, signal?: AbortSignal): Promise<TimelineEntry[]> {
    try {
      const resp = await this.get(
        `${CONFIG.API_BASE}/v007/tours/${tourId}/timeline/`,
        signal,
      );
      const data = await resp.json();
      // Response: { _embedded: { items: [...] }, page: {...} }
      return data._embedded?.items ?? [];
    } catch (err) {
      if (err instanceof AuthExpiredError) throw err;
      return [];
    }
  }

  async fetchCoverImages(tourId: number, signal?: AbortSignal): Promise<CoverImage[]> {
    const cached = this.coverImageCache.get(tourId);
    if (cached) return cached;
    try {
      const resp = await this.get(
        `${CONFIG.API_BASE}/v007/tours/${tourId}/cover_images/`,
        signal,
      );
      const data = await resp.json();
      // Response can be { _embedded: { items: [...] } } or { items: [...] }
      const images: CoverImage[] = data._embedded?.items ?? data.items ?? [];
      this.coverImageCache.set(tourId, images);
      return images;
    } catch (err) {
      if (err instanceof AuthExpiredError) throw err;
      return [];
    }
  }

  async fetchWayTypes(tourId: number, signal?: AbortSignal): Promise<WayTypeSegment[]> {
    try {
      const resp = await this.get(
        `${CONFIG.API_BASE}/v007/tours/${tourId}/way_types`,
        signal,
      );
      const data = await resp.json();
      // Response: { items: [{ from, to, element: "wt#..." }] }
      return data.items ?? [];
    } catch {
      return [];
    }
  }

  async fetchSurfaces(tourId: number, signal?: AbortSignal): Promise<SurfaceSegment[]> {
    try {
      const resp = await this.get(
        `${CONFIG.API_BASE}/v007/tours/${tourId}/surfaces`,
        signal,
      );
      const data = await resp.json();
      // Response: { items: [{ from, to, element: "sb#..." }] }
      return data.items ?? [];
    } catch {
      return [];
    }
  }

  resetCaches(): void {
    this.coordsCache.clear();
    this.coverImageCache.clear();
  }
}

export const Api: IApiClient = new ApiClient();
