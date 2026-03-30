import type {
  AuthState,
  Coordinate,
  CoordinatesApiResponse,
  LoginApiResponse,
  Tour,
  ToursApiResponse,
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
  constructor(message = 'You do not have permission to modify this tour.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export interface IApiClient {
  readonly isAuthenticated: boolean;
  readonly displayName: string;
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
  resetCaches(): void;
}

class ApiClient implements IApiClient {
  private auth: AuthState | null = null;
  private coordsCache = new Map<number, Coordinate[]>();

  get isAuthenticated(): boolean {
    return !!(this.auth && this.auth.userId && this.auth.token);
  }

  get displayName(): string {
    return this.auth?.displayName ?? '';
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

  async fetchAllTours(signal?: AbortSignal): Promise<Tour[]> {
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
    return tours;
  }

  async fetchCoordinates(
    tourId: number,
    signal?: AbortSignal,
  ): Promise<Coordinate[] | null> {
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

  async renameTour(tourId: number, newName: string): Promise<Tour> {
    if (!this.isAuthenticated) throw new Error('Not authenticated');
    const url = `${CONFIG.API_WWW}/v007/tours/${tourId}?hl=${CONFIG.LOCALE}`;
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName }),
    });
    if (resp.status === 401) {
      this.clearAuth();
      throw new AuthExpiredError();
    }
    if (resp.status === 403) {
      throw new ForbiddenError('You cannot rename tours owned by other users.');
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

  resetCaches(): void {
    this.coordsCache.clear();
  }
}

export const Api: IApiClient = new ApiClient();
