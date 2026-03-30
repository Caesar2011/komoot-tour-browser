import type { SPORT_ICONS } from './config.ts';

export type TourType = 'tour_recorded' | 'tour_planned';
export type TourStatus = 'public' | 'private' | 'friends';
export type KnownSport = keyof typeof SPORT_ICONS;
export type SportType = KnownSport | (string & {});

export interface Coordinate {
  lat: number;
  lng: number;
  alt?: number;
  t?: number;
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
  start_point?: { lat: number; lng: number };
  _leafName?: string;
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
