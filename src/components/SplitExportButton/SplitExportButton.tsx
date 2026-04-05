import { useCallback, useRef, useState } from 'preact/hooks';

import type { ExportFormat } from '../../types.ts';

import styles from './SplitExportButton.module.css';

interface Props {
  format: ExportFormat;
  onExport: (format: ExportFormat) => void;
  onFormatChange: (format: ExportFormat) => void;
  disabled?: boolean;
  /** Size variant. */
  size?: 'sm' | 'md';
}

export function SplitExportButton({
  format,
  onExport,
  onFormatChange,
  disabled = false,
  size = 'sm',
}: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (f: ExportFormat) => {
      onFormatChange(f);
      onExport(f);
      setOpen(false);
    },
    [onFormatChange, onExport],
  );

  const sizeClass = size === 'md' ? styles.md : '';

  return (
    <div class={`${styles.wrap} ${sizeClass}`} ref={menuRef}>
      <button
        class={styles.main}
        onClick={() => onExport(format)}
        disabled={disabled}
        title={`Export ${format.toUpperCase()}`}
      >
        📥 {format.toUpperCase()}
      </button>
      <button
        class={styles.arrow}
        onClick={() => setOpen(!open)}
        title="Choose export format"
      >
        ▾
      </button>
      {open && (
        <div class={styles.menu}>
          {(['gpx', 'fit'] as ExportFormat[]).map((f) => (
            <button
              key={f}
              class={`${styles.option} ${f === format ? styles.active : ''}`}
              onClick={() => handleSelect(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
