import { PDFDocument, degrees } from 'pdf-lib';

export type PagePlan = { index: number; rotation?: number };

/** Build a new PDF from source pages in the given order, with extra rotation applied. */
export async function buildFromPlan(bytes: Uint8Array, plan: PagePlan[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, plan.map((p) => p.index));
  copied.forEach((page, i) => {
    const extra = plan[i].rotation ?? 0;
    if (extra) page.setRotation(degrees((((page.getRotation().angle + extra) % 360) + 360) % 360));
    out.addPage(page);
  });
  return out.save();
}
