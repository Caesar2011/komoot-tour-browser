import { useRef, useState } from 'preact/hooks';

import type { ImportResult } from '../../hooks/useCustomNames.ts';
import type { CustomNameRecord } from '../../logic/customNames.ts';
import { DialogShell } from '../DialogShell/DialogShell.tsx';

import styles from './MappingDialog.module.css';

interface Props {
  records: CustomNameRecord[];
  isDirty: boolean;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<ImportResult>;
  onDelete: (tourId: number) => Promise<void>;
  onClose: () => void;
}

export function MappingDialog({
  records,
  isDirty,
  onExport,
  onImport,
  onDelete,
  onClose,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const newestUpdatedAt =
    records.length > 0 ? Math.max(...records.map((r) => r.updatedAt)) : null;

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport();
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    setImportError('');
    setImportSuccess('');
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    (e.target as HTMLInputElement).value = '';
    setImportError('');
    setImportSuccess('');
    setImporting(true);
    try {
      const result = await onImport(file);
      setImportSuccess(
        `Import complete: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped`,
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <DialogShell
      onClose={onClose}
      width={640}
      labelledBy="mapping-title"
      noPadding
    >
      <div class={styles.header}>
        <h3 id="mapping-title" class={styles.title}>
          🏷️ Custom Name Mapping
        </h3>
        <button
          class={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div class={styles.stats}>
        {records.length === 0
          ? 'No custom names yet'
          : `${records.length} custom name${records.length !== 1 ? 's' : ''} stored`}
      </div>

      {isDirty && newestUpdatedAt !== null && (
        <div class={styles.dirtyBanner}>
          ⚠️ Unsaved changes since {new Date(newestUpdatedAt).toLocaleString()}
        </div>
      )}

      <div class={styles.actions}>
        <button
          class={styles.actionBtn}
          onClick={handleExport}
          disabled={exporting || records.length === 0}
          title="Download all mappings as JSON"
        >
          {exporting ? '⏳' : '📤'} Export JSON
        </button>
        <button
          class={styles.actionBtn}
          onClick={handleImportClick}
          disabled={importing}
          title="Import mappings from a JSON file"
        >
          {importing ? '⏳' : '📥'} Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          class={styles.hiddenInput}
          onChange={handleFileChange}
        />
      </div>

      {importError && <div class={styles.errorMsg}>❌ {importError}</div>}
      {importSuccess && <div class={styles.successMsg}>✅ {importSuccess}</div>}

      <div class={styles.tableWrap}>
        {records.length === 0 ? (
          <div class={styles.emptyTable}>
            No custom names stored yet. Rename a tour from another user to
            create one.
          </div>
        ) : (
          <table class={styles.table}>
            <thead>
              <tr>
                <th class={styles.th}>Tour ID</th>
                <th class={styles.th}>Custom Name</th>
                <th class={styles.th}>Changed</th>
                <th class={styles.th} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <MappingRow key={r.tourId} record={r} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div class={styles.footer}>
        <button class={styles.closeFooterBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </DialogShell>
  );
}

function MappingRow({
  record,
  onDelete,
}: {
  record: CustomNameRecord;
  onDelete: (tourId: number) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(record.tourId);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <tr class={styles.tr}>
      <td class={styles.td}>
        <span class={styles.tourId}>{record.tourId}</span>
      </td>
      <td class={styles.td}>
        <span class={styles.customName} title={record.name}>
          {record.name}
        </span>
      </td>
      <td class={styles.td}>
        <span class={styles.changed}>
          {new Date(record.updatedAt).toLocaleString()}
        </span>
      </td>
      <td class={styles.td}>
        <button
          class={styles.deleteRowBtn}
          onClick={handleDelete}
          disabled={deleting}
          title="Remove this custom name"
          aria-label={`Remove custom name for tour ${record.tourId}`}
        >
          {deleting ? '⏳' : '🗑️'}
        </button>
      </td>
    </tr>
  );
}
