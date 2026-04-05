import { zipSync } from 'fflate';

export async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

export function makeZipBlob(
  entries: { name: string; content: Uint8Array }[],
): Blob {
  const files: Parameters<typeof zipSync>[0] = {};
  for (const { name, content } of entries) {
    files[name] = [content, { level: 6 }];
  }
  return new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
    type: 'application/zip',
  });
}

/** Append `_N` suffixes to duplicate filenames. */
export function deduplicateEntries<T extends { name: string }>(
  entries: T[],
): T[] {
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
