import type {
  Coordinate,
  CoverImage,
  ExportFormat,
  FolderContext,
  Selection,
  SurfaceSegment,
  TimelineEntry,
  Tour,
  TourStatus,
  WayTypeSegment,
} from '../../types.ts';

import { Breadcrumb } from './Breadcrumb/Breadcrumb.tsx';
import { TourList } from './TourList/TourList.tsx';
import { TourDetail } from './TourDetail/TourDetail.tsx';
import styles from './DetailPanel.module.css';

interface Props {
  selection: Selection | null;
  folderTours: Tour[];
  tour: Tour | null;
  coords: Coordinate[] | null;
  folderContext: FolderContext | null;
  timeline: TimelineEntry[];
  coverImages: CoverImage[];
  wayTypes: WayTypeSegment[];
  surfaces: SurfaceSegment[];
  onSelectFolder: (path: string) => void;
  onSelectTour: (tour: Tour) => void;
  onRename: (tour: Tour) => void;
  onPatchTour: (
    tourId: number,
    fields: Partial<{ sport: string; status: TourStatus }>,
  ) => Promise<void>;
  onDownloadGpx: (tourId: number, name: string) => Promise<void>;
  onDownloadFit: (tourId: number, name: string) => Promise<void>;
  onDeleteTour: (tour: Tour) => void;
  lastExportFormat: ExportFormat;
  onSetExportFormat: (f: ExportFormat) => void;
}

export function DetailPanel({
  selection,
  folderTours,
  tour,
  coords,
  folderContext,
  timeline,
  coverImages,
  wayTypes,
  surfaces,
  onSelectFolder,
  onSelectTour,
  onRename,
  onPatchTour,
  onDownloadGpx,
  onDownloadFit,
  onDeleteTour,
  lastExportFormat,
  onSetExportFormat,
}: Props) {
  if (!selection) {
    return (
      <div class={styles.panel} tabIndex={0}>
        <div class={styles.content}>
          <div class={styles.empty}>
            <div class={styles.emptyIcon}>🗺️</div>
            <div>Select a tour or folder from the sidebar</div>
          </div>
        </div>
      </div>
    );
  }

  if (selection.type === 'folder') {
    return (
      <div class={styles.panel} tabIndex={0}>
        <div class={styles.content}>
          <Breadcrumb path={selection.path} onNavigate={onSelectFolder} />
          <div class={styles.listHeader}>
            📁 {selection.path || 'All Tours'} ({folderTours.length} tours)
          </div>
          <TourList
            tours={folderTours}
            activeTourId={null}
            onSelectTour={onSelectTour}
          />
        </div>
      </div>
    );
  }

  return (
    <div class={styles.panel} tabIndex={0}>
      <div class={styles.content}>
        {folderContext && (
          <>
            <Breadcrumb path={folderContext.path} onNavigate={onSelectFolder} />
            <div class={styles.backLink}>
              <span
                class={styles.backLinkText}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectFolder(folderContext.path);
                  }
                }}
                onClick={() => onSelectFolder(folderContext.path)}
              >
                ← Back to list
              </span>
            </div>
          </>
        )}
        {tour && (
          <TourDetail
            tour={tour}
            coords={coords ?? null}
            timeline={timeline}
            coverImages={coverImages}
            wayTypes={wayTypes}
            surfaces={surfaces}
            onRename={onRename}
            onPatchTour={onPatchTour}
            onDownloadGpx={onDownloadGpx}
            onDownloadFit={onDownloadFit}
            onDeleteTour={onDeleteTour}
            lastExportFormat={lastExportFormat}
            onSetExportFormat={onSetExportFormat}
          />
        )}
      </div>
    </div>
  );
}
