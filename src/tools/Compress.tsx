import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { ToolShell, Workspace, type ToolApi } from '../components/ToolShell';
import { SinglePdf } from '../components/SinglePdf';
import { PageThumb } from '../components/PageThumb';
import { baseName, canvasToBytes, formatBytes, isPdf, renderPage } from '../lib/pdf';
import type { LoadedPdf } from '../components/usePdf';
import { toolById } from './registry';

const tool = toolById('compress')!;

const LEVELS = {
  low: { label: 'Low compression', desc: 'Lossless clean-up. Keeps text selectable, smaller savings.', dpi: 0, q: 0 },
  recommended: { label: 'Recommended', desc: 'Good quality, good compression (150 DPI images).', dpi: 150, q: 0.72 },
  extreme: { label: 'Extreme compression', desc: 'Smallest file, lower quality (96 DPI images).', dpi: 96, q: 0.5 },
} as const;
type Level = keyof typeof LEVELS;

function CompressView({ pdf, api }: { pdf: LoadedPdf; api: ToolApi }) {
  const [level, setLevel] = useState<Level>('recommended');
  const stem = baseName(pdf.file.name);

  const compress = async () => {
    const { dpi, q } = LEVELS[level];
    let data: Uint8Array;
    if (!dpi) {
      const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true, updateMetadata: false });
      data = await doc.save({ useObjectStreams: true });
    } else {
      // Re-render each page as a JPEG at the target resolution — big wins on scanned / image-heavy PDFs.
      const out = await PDFDocument.create();
      for (let i = 1; i <= pdf.doc.numPages; i++) {
        api.setProgress(`Compressing page ${i} of ${pdf.doc.numPages}`);
        const page = await pdf.doc.getPage(i);
        const vp = page.getViewport({ scale: 1, rotation: page.rotate });
        const canvas = await renderPage(page, { scale: dpi / 72 });
        const img = await out.embedJpg(await canvasToBytes(canvas, 'image/jpeg', q));
        const p = out.addPage([vp.width, vp.height]);
        p.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
      data = await out.save({ useObjectStreams: true });
    }
    const before = pdf.bytes.length;
    if (data.length >= before) {
      return { files: [{ name: `${stem}-compressed.pdf`, data: pdf.bytes }], note: 'This PDF is already well optimised — we could not make it smaller, so here is the original.' };
    }
    const saved = Math.round((1 - data.length / before) * 100);
    return { files: [{ name: `${stem}-compressed.pdf`, data }], note: `Your PDF is now ${saved}% smaller: ${formatBytes(before)} → ${formatBytes(data.length)}` };
  };

  return (
    <Workspace title="Compression level" action="Compress PDF" busy={api.busy}
      onAction={() => api.run(compress)}
      sidebar={<>
        {(Object.keys(LEVELS) as Level[]).map((k) => (
          <label key={k} className={`option-card${level === k ? ' active' : ''}`}>
            <input type="radio" name="level" checked={level === k} onChange={() => setLevel(k)} />
            <div><strong>{LEVELS[k].label}</strong><div className="muted small">{LEVELS[k].desc}</div></div>
          </label>
        ))}
        {level !== 'low' && <p className="hint">Pages are re-rendered as images, so text will no longer be selectable or searchable.</p>}
      </>}>
      <div className="single-preview">
        <PageThumb doc={pdf.doc} index={0} width={220} />
        <div className="file-name">{pdf.file.name}</div>
        <div className="muted">{pdf.doc.numPages} pages · {formatBytes(pdf.file.size)}</div>
      </div>
    </Workspace>
  );
}

export default function Compress() {
  return (
    <ToolShell tool={tool} filter={isPdf}>
      {(api) => <SinglePdf file={api.files[0]} onReset={api.reset}>{(pdf) => <CompressView pdf={pdf} api={api} />}</SinglePdf>}
    </ToolShell>
  );
}
