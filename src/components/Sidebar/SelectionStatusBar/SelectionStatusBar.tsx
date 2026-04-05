import type { ExportFormat } from '../../../types.ts';
import { SplitExportButton } from '../../SplitExportButton/SplitExportButton.tsx';

import styles from './SelectionStatusBar.module.css';

interface Props {
  summary: { count: number; distance: number; duration: number; label: string };
  selectedCount: number;
  canRename: boolean;
  lastExportFormat: ExportFormat;
  onSetExportFormat: (f: ExportFormat) => void;
  onExport: (format: ExportFormat) => void;
  onDelete: () => void;
  onRename: () => void;
  onOpenInKomoot: () => void;
}

export function SelectionStatusBar({
  summary,
  selectedCount: _selectedCount,
  canRename,
  lastExportFormat,
  onSetExportFormat,
  onExport,
  onDelete,
  onRename,
  onOpenInKomoot,
}: Props) {
  return (
    <div class={styles.bar}>
      <div class={styles.summary}>{summary.label}</div>
      <div class={styles.actions}>
        <button
          class={styles.btn}
          onClick={onRename}
          disabled={!canRename}
          title={canRename ? 'Rename' : 'Select exactly 1 owned item to rename'}
        >
          ✏️
        </button>
        <button
          class={styles.btn}
          onClick={onOpenInKomoot}
          title="Open in Komoot"
        >
          🔗
        </button>
        <SplitExportButton
          format={lastExportFormat}
          onExport={onExport}
          onFormatChange={onSetExportFormat}
        />
        <button
          class={`${styles.btn} ${styles.deleteBtn}`}
          onClick={onDelete}
          title="Delete selected"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
