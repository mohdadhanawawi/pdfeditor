import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

/** Modal for drawing, typing or uploading a signature. Resolves to a trimmed transparent PNG data URL. */
export function SignaturePad({ onDone, onCancel }: { onDone: (dataUrl: string, w: number, h: number) => void; onCancel: () => void }) {
  const [tab, setTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [color, setColor] = useState('#1a237e');
  const [name, setName] = useState('');
  const [font, setFont] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const fonts = ['italic 64px "Brush Script MT", "Segoe Script", cursive', 'italic 600 56px Georgia, serif', '56px "Lucida Handwriting", "Comic Sans MS", cursive'];

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6;
    setDirty(false);
  }, [tab]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  const finishCanvas = (src: HTMLCanvasElement) => {
    const out = trim(src);
    if (!out) return;
    onDone(out.toDataURL('image/png'), out.width, out.height);
  };

  const finish = async () => {
    if (tab === 'draw') return finishCanvas(canvas.current!);
    if (tab === 'type') {
      const c = document.createElement('canvas');
      c.width = 1200; c.height = 200;
      const ctx = c.getContext('2d')!;
      ctx.font = fonts[font].replace(/\d+px/, (m) => `${parseInt(m) * 2}px`);
      ctx.fillStyle = color;
      ctx.textBaseline = 'middle';
      ctx.fillText(name, 20, 100);
      return finishCanvas(c);
    }
  };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-head">
          <h3>Create your signature</h3>
          <button className="icon-btn" onClick={onCancel}><Icon name="close" size={18} /></button>
        </div>
        <div className="segmented">
          {(['draw', 'type', 'upload'] as const).map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
        </div>
        {tab === 'draw' && (
          <canvas ref={canvas} className="sig-canvas"
            onPointerDown={(e) => {
              drawing.current = true;
              (e.target as Element).setPointerCapture(e.pointerId);
              const ctx = canvas.current!.getContext('2d')!;
              ctx.strokeStyle = color;
              ctx.beginPath();
              ctx.moveTo(...pos(e));
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const ctx = canvas.current!.getContext('2d')!;
              ctx.lineTo(...pos(e));
              ctx.stroke();
              setDirty(true);
            }}
            onPointerUp={() => (drawing.current = false)} />
        )}
        {tab === 'type' && (
          <div className="sig-type">
            <input autoFocus placeholder="Type your name" value={name} onChange={(e) => setName(e.target.value)} />
            {fonts.map((f, i) => (
              <button key={i} className={`sig-font${font === i ? ' active' : ''}`} style={{ font: f.replace(/\d+px/, '32px'), color }} onClick={() => setFont(i)}>{name || 'Your Name'}</button>
            ))}
          </div>
        )}
        {tab === 'upload' && (
          <label className="dropzone small">
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const bmp = await createImageBitmap(f);
              const c = document.createElement('canvas');
              c.width = bmp.width; c.height = bmp.height;
              c.getContext('2d')!.drawImage(bmp, 0, 0);
              finishCanvas(c);
            }} />
            <span className="btn btn-primary"><Icon name="upload" size={18} /> Upload signature image</span>
            <span className="muted small">PNG with transparent background works best</span>
          </label>
        )}
        <div className="modal-foot">
          {tab !== 'upload' && (
            <div className="row gap center-v">
              {['#000000', '#1a237e', '#c62828'].map((c) => (
                <button key={c} className={`swatch${color === c ? ' active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
              {tab === 'draw' && <button className="btn btn-link" disabled={!dirty} onClick={() => {
                const c = canvas.current!;
                c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
                setDirty(false);
              }}>Clear</button>}
            </div>
          )}
          <div className="grow" />
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          {tab !== 'upload' && <button className="btn btn-primary" disabled={tab === 'draw' ? !dirty : !name.trim()} onClick={finish}>Use signature</button>}
        </div>
      </div>
    </div>
  );
}

/** Crop a canvas to the bounding box of its non-transparent pixels. */
function trim(src: HTMLCanvasElement) {
  const ctx = src.getContext('2d')!;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const pad = 4;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
