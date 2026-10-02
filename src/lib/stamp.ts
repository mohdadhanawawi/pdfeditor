import { PDFDocument, PDFFont, PDFPage, StandardFonts, degrees, type RGB } from 'pdf-lib';

/**
 * Pages can carry a /Rotate entry and a crop box offset. These helpers let tools work in
 * "visual" coordinates (what the reader sees, origin bottom-left, y up) and convert to
 * PDF user space so stamps land where expected on any page.
 */
export function visualFrame(page: PDFPage) {
  const box = page.getCropBox();
  const r = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const swap = r === 90 || r === 270;
  const W = swap ? box.height : box.width;
  const H = swap ? box.width : box.height;
  const toPdf = (vx: number, vy: number) => {
    const { x, y, width: w, height: h } = box;
    switch (r) {
      case 90: return { x: x + w - vy, y: y + vx };
      case 180: return { x: x + w - vx, y: y + h - vy };
      case 270: return { x: x + vy, y: y + h - vx };
      default: return { x: x + vx, y: y + vy };
    }
  };
  return { W, H, rotation: r, toPdf };
}

export const FONTS = {
  Helvetica: StandardFonts.Helvetica,
  'Helvetica Bold': StandardFonts.HelveticaBold,
  'Times Roman': StandardFonts.TimesRoman,
  'Times Bold': StandardFonts.TimesRomanBold,
  Courier: StandardFonts.Courier,
} as const;
export type FontName = keyof typeof FONTS;

/** Standard PDF fonts only cover Latin-1; detect text they can't encode. */
export function canEncode(font: PDFFont, text: string) {
  try { font.encodeText(text); return true; } catch { return false; }
}

const pngCache = new WeakMap<PDFDocument, Map<string, ReturnType<typeof renderTextPng>>>();

/** Render arbitrary (e.g. non-Latin) text into a PNG so it can still be stamped. Cached per document. */
export function textToPng(doc: PDFDocument, text: string, size: number, color: string, bold: boolean) {
  let cache = pngCache.get(doc);
  if (!cache) pngCache.set(doc, (cache = new Map()));
  const key = `${text}|${size}|${color}|${bold}`;
  if (!cache.has(key)) cache.set(key, renderTextPng(doc, text, size, color, bold));
  return cache.get(key)!;
}

async function renderTextPng(doc: PDFDocument, text: string, size: number, color: string, bold: boolean) {
  const scale = 4;
  const font = `${bold ? 'bold ' : ''}${size * scale}px system-ui, sans-serif`;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = font;
  const lines = text.split('\n');
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  const lineH = size * scale * 1.2;
  c.width = Math.ceil(width) + 4;
  c.height = Math.ceil(lineH * lines.length) + 4;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, 2, 2 + i * lineH + size * scale * 0.1));
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
  const img = await doc.embedPng(new Uint8Array(await blob.arrayBuffer()));
  return { img, width: c.width / scale, height: c.height / scale };
}

/** Draw a single line of text centred on visual point (cx, cy), rotated by `angle` degrees (counter-clockwise). */
export async function drawCenteredText(doc: PDFDocument, page: PDFPage, opts: {
  text: string; cx: number; cy: number; size: number; font: PDFFont; color: RGB; hex: string;
  opacity?: number; angle?: number; bold?: boolean;
}) {
  const f = visualFrame(page);
  const angle = opts.angle ?? 0;
  const total = f.rotation + angle;
  const rad = (angle * Math.PI) / 180;
  const rot = (dx: number, dy: number) => ({ x: dx * Math.cos(rad) - dy * Math.sin(rad), y: dx * Math.sin(rad) + dy * Math.cos(rad) });

  if (canEncode(opts.font, opts.text)) {
    const w = opts.font.widthOfTextAtSize(opts.text, opts.size);
    const h = opts.font.heightAtSize(opts.size, { descender: false });
    const off = rot(-w / 2, -h / 2 + h * 0.08);
    const p = f.toPdf(opts.cx + off.x, opts.cy + off.y);
    page.drawText(opts.text, { x: p.x, y: p.y, size: opts.size, font: opts.font, color: opts.color, opacity: opts.opacity, rotate: degrees(total) });
  } else {
    const { img, width, height } = await textToPng(doc, opts.text, opts.size, opts.hex, !!opts.bold);
    const off = rot(-width / 2, -height / 2);
    const p = f.toPdf(opts.cx + off.x, opts.cy + off.y);
    page.drawImage(img, { x: p.x, y: p.y, width, height, opacity: opts.opacity, rotate: degrees(total) });
  }
}

export function textWidth(font: PDFFont, text: string, size: number) {
  return canEncode(font, text) ? font.widthOfTextAtSize(text, size) : text.length * size * 0.55;
}
