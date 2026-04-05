import type { ComponentChildren } from 'preact';
import { useCallback, useEffect } from 'preact/hooks';

import styles from './DialogShell.module.css';

interface Props {
  children: ComponentChildren;
  onClose: () => void;
  width?: number;
  /** ARIA role, defaults to "dialog". Use "alertdialog" for confirmations. */
  role?: 'dialog' | 'alertdialog';
  labelledBy?: string;
  describedBy?: string;
  /** Skip default padding — the child manages its own layout. */
  noPadding?: boolean;
}

export function DialogShell({
  children,
  onClose,
  width = 480,
  role = 'dialog',
  labelledBy,
  describedBy,
  noPadding = false,
}: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <div class={styles.overlay} onClick={handleOverlayClick}>
      <div
        class={`${styles.dialog} ${noPadding ? styles.noPadding : ''}`}
        style={{ width }}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
      >
        {children}
      </div>
    </div>
  );
}
