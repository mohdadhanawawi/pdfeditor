import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { ToolShell, Workspace, type ToolApi } from '../components/ToolShell';
import { SinglePdf } from '../components/SinglePdf';
import { PageThumb } from '../components/PageThumb';
import { baseName, isPdf } from '../lib/pdf';
import { hexToRgb } from '../lib/color';
import { FONTS, drawCenteredText, textWidth, visualFrame, type FontName } from '../lib/stamp';
import type { LoadedPdf } from '../components/usePdf';
import { toolById } from './registry';

const tool = toolById('page-numbers')!;
const POSITIONS = ['tl', 'tc', 'tr', 'bl', 'bc', 'br'] as const;
type Pos = (typeof POSITIONS)[number];
const FORMATS = { n: '{n}', 'page-n': 'Page {n}', 'n-of': '{n} / {total}', 'page-n-of': 'Page {n} of {total}' } as const;
type Fmt = keyof typeof FORMATS;

function View({ pdf, api }: { pdf: LoadedPdf; api: ToolApi }) {
  const n = pdf.doc.numPages;
  const [pos, setPos] = useState<Pos>('bc');
  const [fmt, setFmt] = useState<Fmt>('n-of');
  const [start, setStart] = useState(1);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(n);
  const [size, setSize] = useState(11);
  const [margin, setMargin] = useState(28);
  const [color, setColor] = useState('#222222');
  const [font, setFont] = useState<FontName>('Helvetica');
  const [mirror, setMirror] = useState(false);

  const label = (i: number) => {
    const num = start + (i - (from - 1));
    const total = start + (to - from);
    return FORMATS[fmt].replace('{n}', String(num)).replace('{total}', String(total));
  };

  const apply = async () => {
    const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true });
    const f = await doc.embedFont(FONTS[font]);
    const c = hexToRgb(color);
    for (const [i, page] of doc.getPages().entries()) {
      if (i < from - 1 || i > to - 1) continue;
      const { W, H } = visualFrame(page);
      const text = label(i);
      let p: Pos = pos;
      if (mirror && i % 2 === 1 && p[1] !== 'c') p = (p[0] + (p[1] === 'l' ? 'r' : 'l')) as Pos;
      const tw = textWidth(f, text, size);
      const cx = p[1] === 'l' ? margin + tw / 2 : p[1] === 'c' ? W / 2 : W - margin - tw / 2;
      const cy = p[0] === 't' ? H - margin : margin;
      await drawCenteredText(doc, page, { text, cx, cy, size, font: f, color: c, hex: color });
    }
    return [{ name: `${baseName(pdf.file.name)}-numbered.pdf`, data: await doc.save() }];
  };

  return (
    <Workspace title="Page number options" action="Add page numbers" busy={api.busy} disabled={from > to}
      onAction={() => api.run(apply)}
      sidebar={<>
        <label className="field"><span>Position</span>
          <div className="pos-grid pos-grid-6">{POSITIONS.map((p) => <button key={p} className={pos === p ? 'active' : ''} onClick={() => setPos(p)} aria-label={p} />)}</div>
        </label>
        <label className="check-row"><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Mirror on even pages (book style)</label>
        <label className="field"><span>Format</span>
          <select value={fmt} onChange={(e) => setFmt(e.target.value as Fmt)}>
            {(Object.keys(FORMATS) as Fmt[]).map((k) => <option key={k} value={k}>{FORMATS[k].replace('{n}', '1').replace('{total}', String(n))}</option>)}
          </select>
        </label>
        <div className="row gap">
          <label className="field grow"><span>From page</span><input type="number" min={1} max={n} value={from} onChange={(e) => setFrom(Math.min(n, Math.max(1, +e.target.value || 1)))} /></label>
          <label className="field grow"><span>To page</span><input type="number" min={1} max={n} value={to} onChange={(e) => setTo(Math.min(n, Math.max(1, +e.target.value || 1)))} /></label>
        </div>
        <label className="field"><span>First number</span><input type="number" value={start} onChange={(e) => setStart(+e.target.value || 1)} /></label>
        <div className="row gap">
          <label className="field grow"><span>Font</span>
            <select value={font} onChange={(e) => setFont(e.target.value as FontName)}>{(Object.keys(FONTS) as FontName[]).map((k) => <option key={k}>{k}</option>)}</select>
          </label>
          <label className="field" style={{ width: 70 }}><span>Size</span><input type="number" min={6} max={48} value={size} onChange={(e) => setSize(+e.target.value || 11)} /></label>
          <label className="field" style={{ width: 60 }}><span>Colour</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        </div>
        <label className="field"><span>Margin: {margin}pt</span><input type="range" min={10} max={80} value={margin} onChange={(e) => setMargin(+e.target.value)} /></label>
      </>}>
      <div className="single-preview">
        <div className="wm-preview">
          <PageThumb doc={pdf.doc} index={from - 1} width={300} />
          <div className={`num-text pos-${pos}`} style={{ color, fontSize: Math.max(8, size * 0.9) }}>{label(from - 1)}</div>
        </div>
      </div>
    </Workspace>
  );
}

export default function PageNumbers() {
  return (
    <ToolShell tool={tool} filter={isPdf}>
      {(api) => <SinglePdf file={api.files[0]} onReset={api.reset}>{(pdf) => <View pdf={pdf} api={api} />}</SinglePdf>}
    </ToolShell>
  );
}
