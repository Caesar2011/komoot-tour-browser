import type { ToastMessage } from '../../types.ts';

import styles from './ToastContainer.module.css';

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div class={styles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          class={`${styles.toast} ${toast.type === 'error' ? styles.error : styles.success}`}
        >
          <span class={styles.icon}>
            {toast.type === 'error' ? '❌' : '✅'}
          </span>
          <span class={styles.text}>{toast.text}</span>
          {toast.persistent && (
            <button class={styles.dismiss} onClick={() => onDismiss(toast.id)}>
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
