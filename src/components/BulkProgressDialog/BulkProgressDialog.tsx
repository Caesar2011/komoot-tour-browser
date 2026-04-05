import type { BulkProgress } from '../../types.ts';
import { DialogShell } from '../DialogShell/DialogShell.tsx';

import styles from './BulkProgressDialog.module.css';

interface Props {
  progress: BulkProgress;
  onCancel: () => void;
}

export function BulkProgressDialog({ progress, onCancel }: Props) {
  const pct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <DialogShell onClose={onCancel} width={380}>
      <h3 class={styles.title}>{progress.title}</h3>
      <div class={styles.barWrap}>
        <div class={styles.barFill} style={{ width: `${pct}%` }} />
      </div>
      <div class={styles.info}>
        {progress.current} / {progress.total}
        {progress.cancelled && ' (stopping…)'}
      </div>
      <div class={styles.actions}>
        <button
          class={styles.cancelBtn}
          onClick={onCancel}
          disabled={progress.cancelled}
        >
          {progress.cancelled ? 'Stopping…' : 'Cancel'}
        </button>
      </div>
    </DialogShell>
  );
}
