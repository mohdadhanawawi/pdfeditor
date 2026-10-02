import { PDFDocument, StandardFonts, degrees, LineCapStyle } from 'pdf-lib';
import { hexToRgb } from './color';
import { canEncode, textToPng, visualFrame } from './stamp';

/** All coordinates are in PDF points, relative to the page's visual top-left corner (y grows downward). */
export type Annot =
  | { id: number; page: number; type: 'text'; x: number; y: number; text: string; size: number; color: string; font: TextFont; bold: boolean }
  | { id: number; page: number; type: 'rect'; x: number; y: number; w: number; h: number; color: string; opacity: number; border?: boolean }
  | { id: number; page: number; type: 'image'; x: number; y: number; w: number; h: number; src: string }
  | { id: number; page: number; type: 'path'; points: number[]; color: string; width: number };

export type TextFont = 'sans' | 'serif' | 'mono';
export const LINE_HEIGHT = 1.2;
/** Distance from the top of a CSS line box (line-height 1.2) to the first baseline, as a fraction of font size. */
export const BASELINE = 0.93;

export const CSS_FONTS: Record<TextFont, string> = {
  sans: 'Helvetica, Arial, sans-serif',
  serif: '"Times New Roman", Times, serif',
  mono: '"Courier New", Courier, monospace',
};

const PDF_FONTS = {
  sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold],
  serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold],
  mono: [StandardFonts.Courier, StandardFonts.CourierBold],
} as const;

function dataUrlBytes(url: string) {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function applyAnnotations(bytes: Uint8Array, annots: Annot[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const fontCache = new Map<string, Awaited<ReturnType<typeof doc.embedFont>>>();
  const imageCache = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();
  const font = async (f: TextFont, bold: boolean) => {
    const name = PDF_FONTS[f][bold ? 1 : 0];
    if (!fontCache.has(name)) fontCache.set(name, await doc.embedFont(name));
    return fontCache.get(name)!;
  };

  for (const a of annots) {
    const page = pages[a.page];
    if (!page) continue;
    const { H, rotation, toPdf } = visualFrame(page);
    // visual top-down (x, y) → PDF user space
    const pt = (x: number, y: number) => toPdf(x, H - y);
    const rotate = degrees(rotation);

    if (a.type === 'rect') {
      const p = pt(a.x, a.y + a.h);
      page.drawRectangle({
        x: p.x, y: p.y, width: a.w, height: a.h, rotate,
        ...(a.border
          ? { borderColor: hexToRgb(a.color), borderWidth: 2, borderOpacity: a.opacity }
          : { color: hexToRgb(a.color), opacity: a.opacity }),
      });
    } else if (a.type === 'image') {
      let img = imageCache.get(a.src);
      if (!img) {
        const raw = dataUrlBytes(a.src);
        img = a.src.startsWith('data:image/png') ? await doc.embedPng(raw) : await doc.embedJpg(raw);
        imageCache.set(a.src, img);
      }
      const p = pt(a.x, a.y + a.h);
      page.drawImage(img, { x: p.x, y: p.y, width: a.w, height: a.h, rotate });
    } else if (a.type === 'path') {
      const color = hexToRgb(a.color);
      for (let i = 2; i < a.points.length; i += 2) {
        page.drawLine({
          start: pt(a.points[i - 2], a.points[i - 1]), end: pt(a.points[i], a.points[i + 1]),
          thickness: a.width, color, lineCap: LineCapStyle.Round,
        });
      }
    } else if (a.type === 'text') {
      const f = await font(a.font, a.bold);
      const lines = a.text.replace(/\r/g, '').split('\n');
      if (lines.every((l) => canEncode(f, l))) {
        lines.forEach((line, i) => {
          if (!line) return;
          const p = pt(a.x, a.y + a.size * (BASELINE + i * LINE_HEIGHT));
          page.drawText(line, { x: p.x, y: p.y, size: a.size, font: f, color: hexToRgb(a.color), rotate });
        });
      } else {
        const { img, width, height } = await textToPng(doc, a.text, a.size, a.color, a.bold);
        const p = pt(a.x, a.y + height);
        page.drawImage(img, { x: p.x, y: p.y, width, height, rotate });
      }
    }
  }
  return doc.save();
}
