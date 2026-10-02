import { useEffect, useState } from 'react';
import { PDFDocument, type PDFImage } from 'pdf-lib';
import { ToolShell, Workspace } from '../components/ToolShell';
import { Dropzone } from '../components/Dropzone';
import { Icon } from '../components/Icon';
import { canvasToBytes, objKey, readFile } from '../lib/pdf';
import { toolById } from './registry';

const tool = toolById('jpg-to-pdf')!;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp';
const isImage = (f: File) => /^image\/(jpeg|png|webp|gif|bmp)$/.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name);

const SIZES = { fit: null, a4: [595.28, 841.89], letter: [612, 792] } as const;
type Size = keyof typeof SIZES;
type Orient = 'auto' | 'portrait' | 'landscape';
const MARGINS = { none: 0, small: 20, big: 50 } as const;
type Margin = keyof typeof MARGINS;

async function embedImage(doc: PDFDocument, file: File): Promise<PDFImage> {
  if (file.type === 'image/png') return doc.embedPng(await readFile(file));
  // createImageBitmap honours EXIF orientation, so phone photos come out upright.
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return doc.embedJpg(await canvasToBytes(c, 'image/jpeg', 0.92));
}

function ImageCard({ file, index, total, onMove, onRemove }: { file: File; index: number; total: number; onMove: (a: number, b: number) => void; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return (
    <div className="file-card" draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(index))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onMove(Number(e.dataTransfer.getData('text/plain')), index); }}>
      <div className="card-tools">
        <button title="Move left" disabled={index === 0} onClick={() => onMove(index, index - 1)}><Icon name="up" size={14} /></button>
        <button title="Move right" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}><Icon name="down" size={14} /></button>
        <button title="Remove" onClick={onRemove}><Icon name="close" size={14} /></button>
      </div>
      <div className="thumb-frame" style={{ width: 140, height: 182 }}>{url && <img src={url} alt="" className="thumb-img" />}</div>
      <div className="file-name" title={file.name}>{file.name}</div>
    </div>
  );
}

export default function ImagesToPdf() {
  const [size, setSize] = useState<Size>('a4');
  const [orient, setOrient] = useState<Orient>('auto');
  const [margin, setMargin] = useState<Margin>('small');
  const [merge, setMerge] = useState(true);

  return (
    <ToolShell tool={tool} multiple accept={ACCEPT} filter={isImage} uploadLabel="Select images">
      {({ files, setFiles, run, busy, setProgress }) => {
        const move = (from: number, to: number) => setFiles((prev) => {
          if (from === to || to < 0 || to >= prev.length) return prev;
          const next = [...prev]; const [f] = next.splice(from, 1); next.splice(to, 0, f); return next;
        });
        const build = async () => {
          const docs: PDFDocument[] = [];
          let doc = await PDFDocument.create();
          for (const [i, f] of files.entries()) {
            setProgress(`Adding image ${i + 1} of ${files.length}`);
            if (!merge && i > 0) { docs.push(doc); doc = await PDFDocument.create(); }
            const img = await embedImage(doc, f);
            const m = MARGINS[margin];
            let pw: number, ph: number;
            const base = SIZES[size];
            if (!base) { pw = img.width * 0.75 + m * 2; ph = img.height * 0.75 + m * 2; }
            else {
              const landscape = orient === 'landscape' || (orient === 'auto' && img.width > img.height);
              [pw, ph] = landscape ? [base[1], base[0]] : [base[0], base[1]];
            }
            const page = doc.addPage([pw, ph]);
            const s = Math.min((pw - m * 2) / img.width, (ph - m * 2) / img.height);
            const w = img.width * s, h = img.height * s;
            page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
          }
          docs.push(doc);
          return Promise.all(docs.map(async (d, i) => ({
            name: merge ? 'images.pdf' : `${files[i].name.replace(/\.[^.]+$/, '')}.pdf`,
            data: await d.save(),
          })));
        };
        return (
          <Workspace title="Image to PDF options" action="Convert to PDF" busy={busy} onAction={() => run(build, 'images-pdf.zip')}
            sidebar={<>
              <label className="field"><span>Page size</span>
                <select value={size} onChange={(e) => setSize(e.target.value as Size)}>
                  <option value="a4">A4 (297×210 mm)</option>
                  <option value="letter">US Letter (215×279 mm)</option>
                  <option value="fit">Same as image</option>
                </select>
              </label>
              {size !== 'fit' && (
                <label className="field"><span>Orientation</span>
                  <div className="segmented">
                    {(['auto', 'portrait', 'landscape'] as Orient[]).map((o) => (
                      <button key={o} className={orient === o ? 'active' : ''} onClick={() => setOrient(o)}>{o[0].toUpperCase() + o.slice(1)}</button>
                    ))}
                  </div>
                </label>
              )}
              <label className="field"><span>Margin</span>
                <div className="segmented">
                  {(['none', 'small', 'big'] as Margin[]).map((o) => (
                    <button key={o} className={margin === o ? 'active' : ''} onClick={() => setMargin(o)}>{o === 'none' ? 'No margin' : o[0].toUpperCase() + o.slice(1)}</button>
                  ))}
                </div>
              </label>
              <label className="check-row"><input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} /> Merge all images into one PDF</label>
            </>}>
            <div className="toolbar"><Dropzone compact accept={ACCEPT} multiple label="Add more images" onFiles={(f) => setFiles((p) => [...p, ...f])} /></div>
            <div className="card-grid">
              {files.map((f, i) => <ImageCard key={objKey(f)} file={f} index={i} total={files.length} onMove={move} onRemove={() => setFiles((p) => p.filter((_, j) => j !== i))} />)}
            </div>
          </Workspace>
        );
      }}
    </ToolShell>
  );
}
