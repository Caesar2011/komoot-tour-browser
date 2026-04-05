import type { Tour } from '../types.ts';

import { Api } from './api.ts';
import { triggerDownload } from './utils.ts';

/** Dynamically import JSZip (must be installed as dependency). */
async function getJSZip() {
  return await import('jszip');
}

function safeName(name: string): string {
  return (name || 'tour').replace(/[^a-zA-Z0-9_\-. ]/g, '_');
}

/** Download a single tour as GPX. */
export async function downloadTourGpx(
  tourId: number,
  tourName: string,
): Promise<void> {
  const blob = await Api.downloadGpx(tourId);
  triggerDownload(blob, `${safeName(tourName)}.gpx`);
}

/** Download a single tour as FIT. */
export async function downloadTourFit(
  tourId: number,
  tourName: string,
): Promise<void> {
  const blob = await Api.downloadFit(tourId);
  triggerDownload(blob, `${safeName(tourName)}.fit`);
}

/** Download multiple tours as a zip of GPX files. */
export async function downloadFolderGpx(
  tours: Tour[],
  folderName: string,
): Promise<void> {
  const JSZipModule = await getJSZip();
  const JSZip = JSZipModule.default || JSZipModule;
  const zip = new JSZip();

  const results = await Promise.allSettled(
    tours.map(async (t) => {
      const blob = await Api.downloadGpx(t.id);
      return { name: safeName(t._leafName || t.name) + '.gpx', blob };
    }),
  );

  const nameCount = new Map<string, number>();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    let name = r.value.name;
    const count = nameCount.get(name) || 0;
    if (count > 0) {
      name = name.replace(/\.gpx$/, `_${count}.gpx`);
    }
    nameCount.set(r.value.name, count + 1);
    zip.file(name, r.value.blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  triggerDownload(content, `${safeName(folderName)}.gpx.zip`);
}

/** Download multiple tours as a zip of FIT files. */
export async function downloadFolderFit(
  tours: Tour[],
  folderName: string,
): Promise<void> {
  const JSZipModule = await getJSZip();
  const JSZip = JSZipModule.default || JSZipModule;
  const zip = new JSZip();

  const results = await Promise.allSettled(
    tours.map(async (t) => {
      const blob = await Api.downloadFit(t.id);
      return { name: safeName(t._leafName || t.name) + '.fit', blob };
    }),
  );

  const nameCount = new Map<string, number>();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    let name = r.value.name;
    const count = nameCount.get(name) || 0;
    if (count > 0) {
      name = name.replace(/\.fit$/, `_${count}.fit`);
    }
    nameCount.set(r.value.name, count + 1);
    zip.file(name, r.value.blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  triggerDownload(content, `${safeName(folderName)}.fit.zip`);
}
