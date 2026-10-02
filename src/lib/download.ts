import JSZip from 'jszip';

export type OutputFile = { name: string; data: Uint8Array | Blob };

function toBlob(data: Uint8Array | Blob, name: string) {
  if (data instanceof Blob) return data;
  const type = name.endsWith('.pdf') ? 'application/pdf' : name.endsWith('.zip') ? 'application/zip' : 'application/octet-stream';
  return new Blob([data as BlobPart], { type });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** One file downloads as-is; several get bundled into a zip. */
export async function packageOutputs(files: OutputFile[], zipName: string): Promise<{ blob: Blob; name: string }> {
  if (files.length === 1) return { blob: toBlob(files[0].data, files[0].name), name: files[0].name };
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  return { blob: await zip.generateAsync({ type: 'blob' }), name: zipName };
}
