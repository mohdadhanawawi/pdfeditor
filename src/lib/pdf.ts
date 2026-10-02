// The legacy build is transpiled for older browsers (Safari, older Chrome/Android WebViews);
// the modern build relies on very recent JS built-ins like Map#getOrInsertComputed.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy, PDFPageProxy };

export async function readFile(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** pdf.js transfers the buffer to its worker, so always hand it a copy. */
export function openPdfJs(bytes: Uint8Array) {
  return pdfjs.getDocument({ data: bytes.slice() });
}

export async function renderPage(
  page: PDFPageProxy,
  opts: { scale?: number; maxWidth?: number; rotation?: number; background?: string } = {},
): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1, rotation: page.rotate + (opts.rotation ?? 0) });
  const scale = opts.maxWidth ? opts.maxWidth / base.width : (opts.scale ?? 1);
  const viewport = page.getViewport({ scale, rotation: page.rotate + (opts.rotation ?? 0) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas, viewport, background: opts.background ?? 'white' }).promise;
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), type, quality),
  );
}

export async function canvasToBytes(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.92) {
  return new Uint8Array(await (await canvasToBlob(canvas, type, quality)).arrayBuffer());
}

export function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '');
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const ids = new WeakMap<object, number>();
let nextId = 1;
/** Stable React key for an object (e.g. a File) without relying on list position. */
export function objKey(o: object) {
  let id = ids.get(o);
  if (!id) ids.set(o, (id = nextId++));
  return id;
}
