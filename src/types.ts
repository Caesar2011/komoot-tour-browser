import type { SPORT_ICONS } from './config.ts';

export type TourType = 'tour_recorded' | 'tour_planned';
export type TourStatus = 'public' | 'private' | 'friends';
export type KnownSport = keyof typeof SPORT_ICONS;
export type SportType = KnownSport | (string & {});

export type SortField = 'date' | 'name' | 'distance' | 'elevation' | 'duration';
export type SortDirection = 'asc' | 'desc';

export interface Filters {
  type: TourType | null;
  statusPublic: boolean;
  statusPrivate: boolean;
  statusFriends: boolean;
  startDate: string;
  endDate: string;
  sortField: SortField;
  sortDirection: SortDirection;
  nameQuery: string;
}

export const DEFAULT_FILTERS: Filters = {
  type: null,
  statusPublic: false,
  statusPrivate: false,
  statusFriends: false,
  startDate: '',
  endDate: '',
  sortField: 'date',
  sortDirection: 'desc',
  nameQuery: '',
};

export interface Coordinate {
  lat: number;
  lng: number;
  alt?: number;
  t?: number;
}

export interface WayTypeSummary {
  type: string;
  amount: number;
}

export interface SurfaceSummary {
  type: string;
  amount: number;
}

export interface Tour {
  id: number;
  name: string;
  sport: SportType;
  type: TourType;
  status?: TourStatus;
  date?: string;
  distance: number;
  duration: number;
  elevation_up?: number;
  elevation_down?: number;
  time_in_motion?: number;
  start_point?: { lat: number; lng: number };
  summary?: {
    surfaces: SurfaceSummary[];
    way_types: WayTypeSummary[];
  };
  _leafName?: string;
  _embedded?: {
    creator?: {
      username: string;
      display_name: string;
    };
  };
}

/** Timeline item as returned by GET /v007/tours/{id}/timeline/ */
export interface TimelineEntry {
  index: number;
  type: string;
  cover: {
    src: string;
    templated?: boolean;
    type?: string;
  } | null;
  _embedded?: {
    reference?: {
      location?: { lat: number; lng: number; alt?: number };
    };
  };
}

/** Cover image as returned by GET /v007/tours/{id}/cover_images/ */
export interface CoverImage {
  src: string;
  templated?: boolean;
  type?: string;
  attribution?: string;
}

/** Segment from GET /v007/tours/{id}/way_types — uses `element` with `wt#` prefix */
export interface WayTypeSegment {
  from: number;
  to: number;
  element: string;
}

/** Segment from GET /v007/tours/{id}/surfaces — uses `element` with `sb#` prefix */
export interface SurfaceSegment {
  from: number;
  to: number;
  element: string;
}

export interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  tours: Tour[];
}

export interface TrackEntry {
  tourId: number;
  coords: Coordinate[];
  color: string;
  name: string;
  coverImageUrl?: string;
}

export interface FolderContext {
  path: string;
  tours: Tour[];
}

export interface FolderSelection {
  type: 'folder';
  path: string;
}

export interface TourSelection {
  type: 'tour';
  tourId: number;
  folderContext: FolderContext | null;
}

export type Selection = FolderSelection | TourSelection;

export interface AuthState {
  userId: string;
  token: string;
  displayName: string;
}

export interface ToursApiResponse {
  _embedded?: { tours?: Tour[] };
  page?: {
    totalPages?: number;
    totalElements?: number;
    size?: number;
    number?: number;
  };
}

export interface CoordinatesApiResponse {
  items?: Coordinate[];
}

export interface LoginApiResponse {
  email: string;
  username: string;
  password: string;
  user?: {
    displayname?: string;
  };
}

/** Represents a single sidebar item for keyboard navigation. */
export interface SidebarItem {
  type: 'folder' | 'tour';
  path: string;
  tour?: Tour;
  depth: number;
}
