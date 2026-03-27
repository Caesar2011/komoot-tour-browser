import type { Coordinate, FolderContext, Selection, Tour } from '../../types.ts';

import { Breadcrumb } from './Breadcrumb/Breadcrumb.tsx';
import { TourList } from './TourList/TourList.tsx';
import { TourDetail } from './TourDetail/TourDetail.tsx';
import styles from './DetailPanel.module.css';

interface Props {
  selection: Selection | null;
  folderPath?: string;
  folderTours?: Tour[];
  tour?: Tour | null;
  coords?: Coordinate[] | null;
  folderContext?: FolderContext | null;
  onSelectFolder: (path: string) => void;
  onSelectTour: (tour: Tour) => void;
  onRename: (tour: Tour) => void;
}

export function DetailPanel({
  selection,
  folderPath,
  folderTours,
  tour,
  coords,
  folderContext,
  onSelectFolder,
  onSelectTour,
  onRename,
}: Props) {
  if (!selection) {
    return (
      <div class={styles.panel}>
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
      <div class={styles.panel}>
        <div class={styles.content}>
          <Breadcrumb path={folderPath ?? ''} onNavigate={onSelectFolder} />
          <div class={styles.listHeader}>
            📁 {folderPath || 'All Tours'} ({folderTours?.length ?? 0} tours)
          </div>
          <TourList
            tours={folderTours ?? []}
            activeTourId={null}
            onSelectTour={onSelectTour}
          />
        </div>
      </div>
    );
  }

  // selection.type === 'tour'
  return (
    <div class={styles.panel}>
      <div class={styles.content}>
        {folderContext && (
          <>
            <Breadcrumb path={folderContext.path} onNavigate={onSelectFolder} />
            <div class={styles.backLink}>
              <span
                class={styles.backLinkText}
                onClick={() => onSelectFolder(folderContext.path)}
              >
                ← Back to list
              </span>
            </div>
          </>
        )}
        {tour && (
          <TourDetail tour={tour} coords={coords ?? null} onRename={onRename} />
        )}
      </div>
    </div>
  );
}
