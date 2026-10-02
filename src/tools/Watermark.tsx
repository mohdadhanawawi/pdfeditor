import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { ToolShell, Workspace, type ToolApi } from '../components/ToolShell';
import { SinglePdf } from '../components/SinglePdf';
import { PageThumb } from '../components/PageThumb';
import { baseName, isPdf } from '../lib/pdf';
import { hexToRgb } from '../lib/color';
import { parseRanges } from '../lib/ranges';
import { FONTS, drawCenteredText, textWidth, visualFrame, type FontName } from '../lib/stamp';
import type { LoadedPdf } from '../components/usePdf';
import { toolById } from './registry';

const tool = toolById('watermark')!;
const POSITIONS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'] as const;
type Pos = (typeof POSITIONS)[number] | 'tile';

function View({ pdf, api }: { pdf: LoadedPdf; api: ToolApi }) {
  const [text, setText] = useState('CONFIDENTIAL');
  const [font, setFont] = useState<FontName>('Helvetica Bold');
  const [size, setSize] = useState(60);
  const [color, setColor] = useState('#e5322d');
  const [opacity, setOpacity] = useState(0.3);
  const [angle, setAngle] = useState(45);
  const [pos, setPos] = useState<Pos>('mc');
  const [pages, setPages] = useState('');
  const n = pdf.doc.numPages;

  const apply = async () => {
    const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true });
    const f = await doc.embedFont(FONTS[font]);
    const targets = pages.trim() ? new Set(parseRanges(pages, n).flat()) : null;
    const rgbColor = hexToRgb(color);
    for (const [i, page] of doc.getPages().entries()) {
      if (targets && !targets.has(i)) continue;
      const { W, H } = visualFrame(page);
      const base = { text, size, font: f, color: rgbColor, hex: color, opacity, angle, bold: font.includes('Bold') };
      if (pos === 'tile') {
        const stepX = textWidth(f, text, size) + size * 2;
        const stepY = size * 4;
        for (let y = -H * 0.25; y < H * 1.25; y += stepY)
          for (let x = -W * 0.25 + ((y / stepY) % 2 ? stepX / 2 : 0); x < W * 1.25; x += stepX)
            await drawCenteredText(doc, page, { ...base, cx: x, cy: y });
      } else {
        const m = size * 0.9 + 20;
        const col = pos[1] === 'l' ? 0 : pos[1] === 'c' ? 1 : 2;
        const row = pos[0] === 't' ? 0 : pos[0] === 'm' ? 1 : 2;
        const cx = col === 0 ? m + textWidth(f, text, size) / 2 * Math.abs(Math.cos(angle * Math.PI / 180)) : col === 1 ? W / 2 : W - m - textWidth(f, text, size) / 2 * Math.abs(Math.cos(angle * Math.PI / 180));
        const cy = row === 0 ? H - m : row === 1 ? H / 2 : m;
        await drawCenteredText(doc, page, { ...base, cx, cy });
      }
    }
    return [{ name: `${baseName(pdf.file.name)}-watermarked.pdf`, data: await doc.save() }];
  };

  const previewStyle: React.CSSProperties = {
    color, opacity, fontSize: Math.max(8, size * 0.4), transform: `rotate(${-angle}deg)`,
    fontFamily: font.startsWith('Times') ? 'Times New Roman, serif' : font.startsWith('Courier') ? 'Courier New, monospace' : 'Helvetica, Arial, sans-serif',
    fontWeight: font.includes('Bold') ? 700 : 400,
  };

  return (
    <Workspace title="Watermark options" action="Add watermark" busy={api.busy} disabled={!text.trim()}
      onAction={() => api.run(apply)}
      sidebar={<>
        <label className="field"><span>Text</span><input value={text} onChange={(e) => setText(e.target.value)} /></label>
        <div className="row gap">
          <label className="field grow"><span>Font</span>
            <select value={font} onChange={(e) => setFont(e.target.value as FontName)}>
              {(Object.keys(FONTS) as FontName[]).map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="field" style={{ width: 80 }}><span>Colour</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        </div>
        <label className="field"><span>Size: {size}pt</span><input type="range" min={10} max={150} value={size} onChange={(e) => setSize(+e.target.value)} /></label>
        <label className="field"><span>Opacity: {Math.round(opacity * 100)}%</span><input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(+e.target.value)} /></label>
        <label className="field"><span>Rotation</span>
          <div className="segmented">{[0, 45, 90, -45].map((a) => <button key={a} className={angle === a ? 'active' : ''} onClick={() => setAngle(a)}>{a}°</button>)}</div>
        </label>
        <label className="field"><span>Position</span>
          <div className="row gap center-v">
            <div className="pos-grid">{POSITIONS.map((p) => <button key={p} className={pos === p ? 'active' : ''} onClick={() => setPos(p)} aria-label={p} />)}</div>
            <label className="check-row"><input type="checkbox" checked={pos === 'tile'} onChange={(e) => setPos(e.target.checked ? 'tile' : 'mc')} /> Mosaic (repeat)</label>
          </div>
        </label>
        <label className="field"><span>Pages (blank = all)</span><input value={pages} placeholder={`1-${n}`} onChange={(e) => setPages(e.target.value)} /></label>
      </>}>
      <div className="single-preview">
        <div className="wm-preview">
          <PageThumb doc={pdf.doc} index={0} width={300} />
          <div className={`wm-text pos-${pos}`}><span style={previewStyle}>{text}</span></div>
        </div>
        <p className="muted small">Preview is approximate.</p>
      </div>
    </Workspace>
  );
}

export default function Watermark() {
  return (
    <ToolShell tool={tool} filter={isPdf}>
      {(api) => <SinglePdf file={api.files[0]} onReset={api.reset}>{(pdf) => <View pdf={pdf} api={api} />}</SinglePdf>}
    </ToolShell>
  );
}
