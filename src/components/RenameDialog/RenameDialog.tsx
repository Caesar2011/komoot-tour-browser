import { useEffect, useRef, useState } from 'preact/hooks';

import type { Tour } from '../../types.ts';

import styles from './RenameDialog.module.css';

interface Props {
  tour: Tour | null;
  onSave: (newName: string) => Promise<void>;
  onClose: () => void;
}

export function RenameDialog({ tour, onSave, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tour && inputRef.current) {
      inputRef.current.value = tour.name || '';
      inputRef.current.focus();
    }
    setError('');
    setSaving(false);
  }, [tour]);

  if (!tour) return null;

  const handleSave = async () => {
    const newName = inputRef.current?.value.trim() ?? '';
    if (!newName) {
      setError('Name cannot be empty.');
      return;
    }
    if (newName === tour.name) {
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

  return (
    <div class={styles.overlay} onClick={handleOverlayClick}>
      <div class={styles.dialog}>
        <h3>✏️ Rename Tour</h3>
        <label class="form-label" for="renameInput">
          Tour Name (full path)
        </label>
        <input
          ref={inputRef}
          class={`form-input ${styles.inputSpacing}`}
          type="text"
          id="renameInput"
          placeholder="Folder / Subfolder / Tour Name"
          onKeyDown={handleKeyDown}
        />
        <div class={styles.hint}>
          Use <strong>/</strong> to organize into folders. The entire name
          including path is editable.
        </div>
        {error && <div class="form-error">{error}</div>}
        <div class={styles.actions}>
          <button class={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button class={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
