import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';

import type { Tour } from '../../types.ts';

import styles from './RenameDialog.module.css';

interface Props {
  /** Pass `tour` to rename a tour, or `folder` (path string) to rename a folder. */
  tour?: Tour | null;
  folder?: string | null;
  onSave: (newName: string) => Promise<void>;
  onClose: () => void;
}

export function RenameDialog({ tour, folder, onSave, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isFolder = typeof folder === 'string';
  const isTour = tour != null;
  const isVisible = isFolder || isTour;

  const initialValue = isFolder
    ? folder.split('/').pop() || ''
    : isTour
      ? tour.name || ''
      : '';

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.value = initialValue;
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
    setError('');
    setSaving(false);
  }, [isVisible, initialValue]);

  if (!isVisible) return null;

  const handleSave = async () => {
    const newName = inputRef.current?.value.trim() ?? '';
    if (!newName) {
      setError('Name cannot be empty.');
      return;
    }
    if (newName === initialValue) {
      onClose();
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(newName);
    } catch (e) {
      setError(
        'Rename failed: ' + (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') onClose();
  };

  const handleOverlayClick = (e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const title = isFolder ? '✏️ Rename Folder' : '✏️ Rename Tour';
  const hint = isFolder
    ? 'All tours inside this folder will be renamed accordingly.'
    : 'Use / to organize into folders. The entire name including path is editable.';

  return (
    <div class={styles.overlay} onClick={handleOverlayClick}>
      <div class={styles.dialog}>
        <h3>{title}</h3>
        <label class="form-label" for="renameInput">
          {isFolder ? 'Folder Name' : 'Tour Name (full path)'}
        </label>
        <input
          ref={inputRef}
          class={`form-input ${styles.inputSpacing}`}
          type="text"
          id="renameInput"
          placeholder={isFolder ? 'New folder name' : 'Folder / Subfolder / Tour Name'}
          onKeyDown={handleKeyDown}
        />
        <div class={styles.hint}>
          {hint}
        </div>
        {error && <div class="form-error">{error}</div>}
        <div class={styles.actions}>
          <button class={styles.cancelBtn} onClick={onClose} tabIndex={0}>
            Cancel
          </button>
          <button class={styles.saveBtn} onClick={handleSave} disabled={saving} tabIndex={0}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
