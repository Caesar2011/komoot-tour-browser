import { useEffect, useRef, useState } from 'preact/hooks';

import { formatDist, formatDur } from '../../logic/utils.ts';
import { DialogShell } from '../DialogShell/DialogShell.tsx';

import styles from './ConfirmDialog.module.css';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  bulkInfo?: {
    tourCount: number;
    totalDistance: number;
    totalDuration: number;
    confirmText: string;
  };
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  bulkInfo,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirmInput, setConfirmInput] = useState('');

  const needsTextConfirm = bulkInfo && bulkInfo.tourCount > 5;
  const isConfirmEnabled = needsTextConfirm
    ? confirmInput === bulkInfo!.confirmText
    : true;

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <DialogShell
      onClose={onCancel}
      width={440}
      role="alertdialog"
      labelledBy="confirm-title"
      describedBy="confirm-msg"
    >
      <h3 id="confirm-title" class={styles.title}>
        {title}
      </h3>
      <p id="confirm-msg" class={styles.message}>
        {message}
      </p>

      {bulkInfo && (
        <div class={styles.statsRow}>
          <span>
            {bulkInfo.tourCount} tour{bulkInfo.tourCount !== 1 ? 's' : ''}
          </span>
          <span>·</span>
          <span>{formatDist(bulkInfo.totalDistance)}</span>
          <span>·</span>
          <span>{formatDur(bulkInfo.totalDuration)}</span>
        </div>
      )}

      <p class={styles.warning}>
        ⚠️ This will permanently delete these tours on Komoot. This action
        cannot be undone.
      </p>

      {needsTextConfirm && (
        <div class={styles.confirmField}>
          <label class={styles.confirmLabel}>
            Type <strong>"{bulkInfo!.confirmText}"</strong> to confirm:
          </label>
          <input
            class={styles.confirmInput}
            type="text"
            value={confirmInput}
            onInput={(e) =>
              setConfirmInput((e.target as HTMLInputElement).value)
            }
            placeholder={bulkInfo!.confirmText}
          />
        </div>
      )}

      <div class={styles.actions}>
        <button ref={cancelRef} class={styles.cancelBtn} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          class={styles.confirmBtn}
          onClick={onConfirm}
          disabled={!isConfirmEnabled}
        >
          {confirmLabel}
        </button>
      </div>
    </DialogShell>
  );
}
