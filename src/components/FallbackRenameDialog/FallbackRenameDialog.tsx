import { useState } from 'preact/hooks';

import type { Tour } from '../../types.ts';
import { Api } from '../../logic/api.ts';
import { isOwnTour } from '../../logic/utils.ts';
import { resolveDisplayName } from '../../logic/tourName.ts';
import { DialogShell } from '../DialogShell/DialogShell.tsx';

import styles from './FallbackRenameDialog.module.css';

interface Props {
  tour: Tour;
  customNames: Map<number, string>;
  onSave: (newName: string) => Promise<void>;
  onCancel: () => void;
}

export function FallbackRenameDialog({
  tour,
  customNames,
  onSave,
  onCancel,
}: Props) {
  const isForeign = !isOwnTour(tour, Api.userId);
  const displayName = resolveDisplayName(tour, customNames);
  const initialValue = isForeign ? displayName : tour.name;
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (isForeign && trimmed === initialValue) {
      onCancel();
      return;
    }
    if (!isForeign && (!trimmed || trimmed === tour.name)) {
      onCancel();
      return;
    }
    setSaving(true);
    await onSave(trimmed);
    setSaving(false);
  };

  return (
    <DialogShell onClose={onCancel}>
      <h3 class={styles.heading}>
        {isForeign ? '🏷️ Set Custom Name' : '✏️ Rename Tour'}
      </h3>
      {isForeign && (
        <p class={styles.hint}>
          Original: <em>{tour.name}</em>
          <br />
          Leave empty to remove the custom name.
        </p>
      )}
      <input
        class="form-input"
        type="text"
        value={value}
        onInput={(e) => setValue((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') onCancel();
        }}
        style={{ marginBottom: 16 }}
        autoFocus
      />
      <div class="dialog-actions">
        <button class="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button class="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </DialogShell>
  );
}
