import { useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';

import type { TourStatus } from '../../types.ts';
import { SPORT_LABELS } from '../../config.ts';

import styles from './UploadDialog.module.css';

interface Props {
  uploading: boolean;
  error: string;
  onUpload: (
    file: File,
    options: { name?: string; sport?: string; status?: TourStatus },
  ) => Promise<void>;
  onClose: () => void;
}

export function UploadDialog({ uploading, error, onUpload, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [sport, setSport] = useState('');
  const [status, setStatus] = useState<TourStatus>('private');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setLocalError('Please select a file.');
      return;
    }
    setLocalError('');
    const options: { name?: string; sport?: string; status?: TourStatus } = {};
    const name = nameRef.current?.value.trim();
    if (name) options.name = name;
    if (sport) options.sport = sport;
    options.status = status;
    await onUpload(file, options);
  };

  const handleOverlayClick = (e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const sportOptions = Object.entries(SPORT_LABELS)
    .filter((_, i, arr) => {
      // Deduplicate by value
      return arr.findIndex(([, v]) => v === SPORT_LABELS[arr[i][0]]) === i;
    })
    .sort(([, a], [, b]) => a.localeCompare(b));

  // Deduplicate properly
  const seen = new Set<string>();
  const uniqueSports: [string, string][] = [];
  for (const [key, label] of sportOptions) {
    if (!seen.has(label)) {
      seen.add(label);
      uniqueSports.push([key, label]);
    }
  }

  return (
    <div class={styles.overlay} onClick={handleOverlayClick}>
      <div class={styles.dialog}>
        <h3>📤 Upload Tour</h3>
        <form onSubmit={handleSubmit}>
          <label class="form-label" htmlFor="uploadFile">
            File (GPX, FIT, TCX)
          </label>
          <input
            ref={fileRef}
            class={styles.fileInput}
            type="file"
            id="uploadFile"
            accept=".gpx,.fit,.tcx"
          />

          <label class="form-label" htmlFor="uploadName">
            Name (optional)
          </label>
          <input
            ref={nameRef}
            class={`form-input ${styles.inputSpacing}`}
            type="text"
            id="uploadName"
            placeholder="Tour name (read from file if empty)"
          />

          <label class="form-label" htmlFor="uploadSport">
            Sport Type
          </label>
          <select
            class={`form-input ${styles.inputSpacing}`}
            id="uploadSport"
            value={sport}
            onChange={(e) => setSport((e.target as HTMLSelectElement).value)}
          >
            <option value="">Auto-detect</option>
            {uniqueSports.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <label class="form-label" htmlFor="uploadStatus">
            Visibility
          </label>
          <select
            class={`form-input ${styles.inputSpacing}`}
            id="uploadStatus"
            value={status}
            onChange={(e) =>
              setStatus((e.target as HTMLSelectElement).value as TourStatus)
            }
          >
            <option value="private">🔒 Private</option>
            <option value="friends">👥 Friends</option>
            <option value="public">🌍 Public</option>
          </select>

          {(localError || error) && (
            <div class="form-error">{localError || error}</div>
          )}

          <div class={styles.actions}>
            <button type="button" class={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" class={styles.saveBtn} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
