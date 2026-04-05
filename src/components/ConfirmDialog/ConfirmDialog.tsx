import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';

import { formatDist, formatDur } from '../../logic/utils.ts';

import styles from './ConfirmDialog.module.css';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** If set, shows tour stats and requires text confirmation for >5 tours. */
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

  const handleOverlayClick = (e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      class={styles.overlay}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div
        class={styles.dialog}
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-msg"
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
      </div>
    </div>
  );
}
