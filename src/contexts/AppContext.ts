import { createContext } from 'preact';

import type { useAuth } from '../hooks/useAuth.ts';
import type { useTours } from '../hooks/useTours.ts';
import type { useSelection } from '../hooks/useSelection.ts';
import type { useCustomNames } from '../hooks/useCustomNames.ts';
import type { useRename } from '../hooks/useRename.ts';
import type { useUpload } from '../hooks/useUpload.ts';
import type { useSidebarSelection } from '../hooks/useSidebarSelection.ts';
import type { useBulkOperations } from '../hooks/useBulkOperations.ts';
import type { useDragDrop } from '../hooks/useDragDrop.ts';
import type {
  ExportFormat,
  Tour,
  TourStatus,
  FolderContext,
} from '../types.ts';

export interface AppContextValue {
  userId: string;

  auth: ReturnType<typeof useAuth>;
  tours: ReturnType<typeof useTours>;
  sel: ReturnType<typeof useSelection>;
  customNameHook: ReturnType<typeof useCustomNames>;
  rename: ReturnType<typeof useRename>;
  upload: ReturnType<typeof useUpload>;
  sidebarSel: ReturnType<typeof useSidebarSelection>;
  bulk: ReturnType<typeof useBulkOperations>;
  dragDrop: ReturnType<typeof useDragDrop>;

  lastExportFormat: ExportFormat;
  setLastExportFormat: (f: ExportFormat) => void;

  handlePatchTour: (
    tourId: number,
    fields: Partial<{ sport: string; status: TourStatus }>,
  ) => Promise<void>;
  handleActivateItem: (
    type: 'folder' | 'tour',
    path: string,
    tourId?: number,
  ) => Promise<void>;
  handleInlineRename: (tour: Tour, newName: string) => Promise<void>;
  handleFolderRename: (oldPath: string, newName: string) => Promise<void>;
  handleBulkDelete: () => void;
  handleBulkExport: (format: ExportFormat) => void;
  handleOpenInKomoot: () => void;
  handleRefreshDetail: (
    tour: Tour,
    folderContext: FolderContext | null,
  ) => Promise<void>;

  requestDeleteTours: (tours: Tour[]) => void;
  requestRenameTour: (tour: Tour) => void;
}

export const AppContext = createContext<AppContextValue>(null!);
