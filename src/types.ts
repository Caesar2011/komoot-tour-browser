export interface Coordinate {
  lat: number;
  lng: number;
  alt?: number;
}

export interface Tour {
  id: number;
  name: string;
  sport: string;
  type: string;
  status?: string;
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
  coords: Coordinate[];
  color: string;
  name: string;
}

export interface FolderContext {
  path: string;
  tours: Tour[];
}

export type Selection =
  | { type: 'folder'; path: string }
  | { type: 'tour'; tourId: number; folderContext: FolderContext | null };

export interface AuthState {
  userId: string;
  token: string;
  displayName: string;
}
