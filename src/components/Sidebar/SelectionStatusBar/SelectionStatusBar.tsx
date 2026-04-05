import { useCallback, useRef, useState } from 'preact/hooks';

import type { ExportFormat } from '../../../types.ts';

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
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleExportClick = useCallback(() => {
    onExport(lastExportFormat);
  }, [lastExportFormat, onExport]);

  const handleFormatSelect = useCallback(
    (format: ExportFormat) => {
      onSetExportFormat(format);
      onExport(format);
      setShowFormatMenu(false);
    },
    [onSetExportFormat, onExport],
  );

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
        <div class={styles.splitBtn} ref={menuRef}>
          <button
            class={styles.btn}
            onClick={handleExportClick}
            title={`Export ${lastExportFormat.toUpperCase()}`}
          >
            📥 {lastExportFormat.toUpperCase()}
          </button>
          <button
            class={styles.splitArrow}
            onClick={() => setShowFormatMenu(!showFormatMenu)}
            title="Choose export format"
          >
            ▾
          </button>
          {showFormatMenu && (
            <div class={styles.formatMenu}>
              <button
                class={`${styles.formatOption} ${lastExportFormat === 'gpx' ? styles.formatActive : ''}`}
                onClick={() => handleFormatSelect('gpx')}
              >
                GPX
              </button>
              <button
                class={`${styles.formatOption} ${lastExportFormat === 'fit' ? styles.formatActive : ''}`}
                onClick={() => handleFormatSelect('fit')}
              >
                FIT
              </button>
            </div>
          )}
        </div>
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
