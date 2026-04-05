import { useAppContext } from '../../contexts/useAppContext.ts';

import { Breadcrumb } from './Breadcrumb/Breadcrumb.tsx';
import { TourList } from './TourList/TourList.tsx';
import { TourDetail } from './TourDetail/TourDetail.tsx';
import styles from './DetailPanel.module.css';

export function DetailPanel() {
  const {
    sel,
    handlePatchTour,
    requestDeleteTours,
    requestRenameTour,
    handleRefreshDetail,
    lastExportFormat,
    setLastExportFormat,
    customNameHook,
  } = useAppContext();

  const {
    selection,
    folderTours,
    detailTour,
    detailCoords,
    detailFolderContext,
    detailTimeline,
    detailCoverImages,
    detailWayTypes,
    detailSurfaces,
  } = sel;

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
          <Breadcrumb
            path={selection.path}
            onNavigate={sel.handleSelectFolder}
          />
          <div class={styles.listHeader}>
            📁 {selection.path || 'All Tours'} ({folderTours.length} tours)
          </div>
          <TourList
            tours={folderTours}
            activeTourId={null}
            onSelectTour={sel.handleSelectTourFromList}
          />
        </div>
      </div>
    );
  }

  return (
    <div class={styles.panel} tabIndex={0}>
      <div class={styles.content}>
        {detailFolderContext && (
          <>
            <Breadcrumb
              path={detailFolderContext.path}
              onNavigate={sel.handleSelectFolder}
            />
            <div class={styles.backLink}>
              <span
                class={styles.backLinkText}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    sel.handleSelectFolder(detailFolderContext.path);
                  }
                }}
                onClick={() => sel.handleSelectFolder(detailFolderContext.path)}
              >
                ← Back to list
              </span>
            </div>
          </>
        )}
        {detailTour && (
          <TourDetail
            tour={detailTour}
            coords={detailCoords ?? null}
            timeline={detailTimeline}
            coverImages={detailCoverImages}
            wayTypes={detailWayTypes}
            surfaces={detailSurfaces}
            folderContext={detailFolderContext}
            onRename={requestRenameTour}
            onPatchTour={handlePatchTour}
            onDeleteTour={(tour) => requestDeleteTours([tour])}
            onRefresh={handleRefreshDetail}
            lastExportFormat={lastExportFormat}
            onSetExportFormat={setLastExportFormat}
            customNames={customNameHook.customNames}
          />
        )}
      </div>
    </div>
  );
}
