import type { ExportFormat, Tour } from '../types.ts';

import { Api } from './api.ts';
import { safeName, triggerDownload } from './utils.ts';
import { blobToUint8Array, makeZipBlob } from './zip.ts';

function downloadBlob(tourId: number, format: ExportFormat): Promise<Blob> {
  return format === 'gpx' ? Api.downloadGpx(tourId) : Api.downloadFit(tourId);
}

/** Download a single tour in the given format. */
export async function downloadTour(
  tourId: number,
  tourName: string,
  format: ExportFormat,
): Promise<void> {
  const blob = await downloadBlob(tourId, format);
  triggerDownload(blob, `${safeName(tourName)}.${format}`);
}

export interface ZipExportOptions {
  /** Called after each tour is processed (success or failure). */
  onProgress?: (current: number, total: number) => void;
  /** If returns true, abort remaining downloads. */
  isCancelled?: () => boolean;
}

/**
 * Download multiple tours as a zip archive.
 * Returns the count of successfully downloaded files.
 */
export async function downloadToursZip(
  tours: Tour[],
  archiveName: string,
  format: ExportFormat,
  options: ZipExportOptions = {},
): Promise<number> {
  const { onProgress, isCancelled } = options;
  const entries: { name: string; content: Uint8Array }[] = [];
  const nameCount = new Map<string, number>();

  for (let i = 0; i < tours.length; i++) {
    if (isCancelled?.()) break;

    try {
      const blob = await downloadBlob(tours[i].id, format);
      const baseName =
        safeName(tours[i]._leafName || tours[i].name) + `.${format}`;
      const count = nameCount.get(baseName) ?? 0;
      nameCount.set(baseName, count + 1);

      const dot = baseName.lastIndexOf('.');
      const uniqueName =
        count === 0
          ? baseName
          : `${baseName.slice(0, dot)}_${count}${baseName.slice(dot)}`;

      entries.push({
        name: uniqueName,
        content: await blobToUint8Array(blob),
      });
    } catch {
      // Skip failed downloads
    }

    onProgress?.(i + 1, tours.length);
  }

  if (entries.length > 0) {
    triggerDownload(
      makeZipBlob(entries),
      `${safeName(archiveName)}.${format}.zip`,
    );
  }

  return entries.length;
}
