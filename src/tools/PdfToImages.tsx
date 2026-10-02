import { useState } from 'react';
import { ToolShell, Workspace, type ToolApi } from '../components/ToolShell';
import { SinglePdf } from '../components/SinglePdf';
import { PageGrid } from '../components/PageGrid';
import { baseName, canvasToBlob, isPdf, renderPage } from '../lib/pdf';
import type { LoadedPdf } from '../components/usePdf';
import { toolById } from './registry';

const tool = toolById('pdf-to-jpg')!;
const QUALITY = { normal: { label: 'Normal (96 DPI)', dpi: 96 }, high: { label: 'High (150 DPI)', dpi: 150 }, print: { label: 'Print (300 DPI)', dpi: 300 } } as const;
type Q = keyof typeof QUALITY;

function View({ pdf, api }: { pdf: LoadedPdf; api: ToolApi }) {
  const [q, setQ] = useState<Q>('high');
  const [fmt, setFmt] = useState<'jpg' | 'png'>('jpg');
  const n = pdf.doc.numPages;
  const stem = baseName(pdf.file.name);
  return (
    <Workspace title="PDF to image" action={`Convert to ${fmt.toUpperCase()}`} busy={api.busy}
      onAction={() => api.run(async () => {
        const out = [];
        for (let i = 1; i <= n; i++) {
          api.setProgress(`Rendering page ${i} of ${n}`);
          const page = await pdf.doc.getPage(i);
          const c = await renderPage(page, { scale: QUALITY[q].dpi / 72 });
          out.push({ name: `${stem}-${String(i).padStart(String(n).length, '0')}.${fmt}`, data: await canvasToBlob(c, fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.9) });
          c.width = c.height = 0;
          page.cleanup();
        }
        return out;
      }, `${stem}-images.zip`)}
      sidebar={<>
        <label className="field"><span>Format</span>
          <div className="segmented">
            <button className={fmt === 'jpg' ? 'active' : ''} onClick={() => setFmt('jpg')}>JPG</button>
            <button className={fmt === 'png' ? 'active' : ''} onClick={() => setFmt('png')}>PNG</button>
          </div>
        </label>
        <label className="field"><span>Image quality</span>
          <select value={q} onChange={(e) => setQ(e.target.value as Q)}>
            {(Object.keys(QUALITY) as Q[]).map((k) => <option key={k} value={k}>{QUALITY[k].label}</option>)}
          </select>
        </label>
        <p className="muted">{n} page{n === 1 ? '' : 's'} → {n} image{n === 1 ? '' : 's'}{n > 1 ? ' in a ZIP' : ''}</p>
      </>}>
      <PageGrid doc={pdf.doc} pages={Array.from({ length: n }, (_, i) => ({ key: i, index: i }))} />
    </Workspace>
  );
}

export default function PdfToImages() {
  return (
    <ToolShell tool={tool} filter={isPdf}>
      {(api) => <SinglePdf file={api.files[0]} onReset={api.reset}>{(pdf) => <View pdf={pdf} api={api} />}</SinglePdf>}
    </ToolShell>
  );
}
