import { zipSync } from 'fflate';

import type { Tour } from '../types.ts';

import { Api } from './api.ts';
import { triggerDownload } from './utils.ts';

function safeName(name: string): string {
  return (name || 'tour').replace(/[^a-zA-Z0-9_\-. ]/g, '_');
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function makeZipBlob(entries: { name: string; content: Uint8Array }[]): Blob {
  const files: Parameters<typeof zipSync>[0] = {};
  for (const { name, content } of entries) {
    files[name] = [content, { level: 6 }];
  }
  return new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
    type: 'application/zip',
  });
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
  const results = await Promise.allSettled(
    tours.map(async (t) => ({
      name: safeName(t._leafName || t.name) + '.gpx',
      content: await blobToUint8Array(await Api.downloadGpx(t.id)),
    })),
  );
  const entries = deduplicateEntries(
    results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
  );
  triggerDownload(makeZipBlob(entries), `${safeName(folderName)}.gpx.zip`);
}

/** Download multiple tours as a zip of FIT files. */
export async function downloadFolderFit(
  tours: Tour[],
  folderName: string,
): Promise<void> {
  const results = await Promise.allSettled(
    tours.map(async (t) => ({
      name: safeName(t._leafName || t.name) + '.fit',
      content: await blobToUint8Array(await Api.downloadFit(t.id)),
    })),
  );
  const entries = deduplicateEntries(
    results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
  );
  triggerDownload(makeZipBlob(entries), `${safeName(folderName)}.fit.zip`);
}

/** Append `_N` suffixes to duplicate filenames within a set of entries. */
function deduplicateEntries<T extends { name: string }>(entries: T[]): T[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    const count = seen.get(e.name) ?? 0;
    seen.set(e.name, count + 1);
    if (count === 0) return e;
    const dot = e.name.lastIndexOf('.');
    const base = dot >= 0 ? e.name.slice(0, dot) : e.name;
    const ext = dot >= 0 ? e.name.slice(dot) : '';
    return { ...e, name: `${base}_${count}${ext}` };
  });
}
