import { useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';

import styles from './ConfirmDialog.module.css';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

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
      <div class={styles.dialog} role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-msg">
        <h3 id="confirm-title" class={styles.title}>{title}</h3>
        <p id="confirm-msg" class={styles.message}>{message}</p>
        <div class={styles.actions}>
          <button
            ref={cancelRef}
            class={styles.cancelBtn}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            class={styles.confirmBtn}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
