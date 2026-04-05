import type { KnownSport } from './config.ts';

export type TourType = 'tour_recorded' | 'tour_planned';
export type TourStatus = 'public' | 'private' | 'friends';
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
  sports: string[];
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
  sports: [],
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

export interface CoverImage {
  src: string;
  templated?: boolean;
  type?: string;
  attribution?: string;
}

export interface WayTypeSegment {
  from: number;
  to: number;
  element: string;
}

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

export interface SidebarItem {
  type: 'folder' | 'tour';
  path: string;
  tour?: Tour;
  depth: number;
}

export type SelectionItemKey = string;

export interface SelectionItem {
  type: 'folder' | 'tour';
  path: string;
  tourId?: number;
}

export type ExportFormat = 'gpx' | 'fit';

export interface BulkProgress {
  title: string;
  current: number;
  total: number;
  cancelled: boolean;
}

export interface BulkResult {
  success: number;
  failed: number;
  errors: string[];
}

export interface ToastMessage {
  id: number;
  type: 'success' | 'error';
  text: string;
  persistent: boolean;
}
