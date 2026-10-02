import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ToolShell, type ToolApi } from '../components/ToolShell';
import { SinglePdf } from '../components/SinglePdf';
import { SignaturePad } from '../components/SignaturePad';
import { Icon } from '../components/Icon';
import { baseName, isPdf, renderPage, type PDFDocumentProxy } from '../lib/pdf';
import { applyAnnotations, CSS_FONTS, LINE_HEIGHT, type Annot, type TextFont } from '../lib/annotations';
import type { LoadedPdf } from '../components/usePdf';
import { toolById } from './registry';

type Tool = 'select' | 'text' | 'whiteout' | 'highlight' | 'rect' | 'pen' | 'image' | 'sign';
type Size = { w: number; h: number };
type Pending = { src: string; w: number; h: number };
type Draft = { page: number; x0: number; y0: number; x1: number; y1: number; points?: number[] };

const TOOLBAR: { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: 'pointer' },
  { id: 'text', label: 'Text', icon: 'text' },
  { id: 'pen', label: 'Draw', icon: 'pen' },
  { id: 'rect', label: 'Shape', icon: 'rect' },
  { id: 'highlight', label: 'Highlight', icon: 'edit' },
  { id: 'whiteout', label: 'Whiteout', icon: 'rect' },
  { id: 'image', label: 'Image', icon: 'image' },
  { id: 'sign', label: 'Sign', icon: 'sign' },
];

let nextId = 1;

function EditorView({ pdf, api, startTool }: { pdf: LoadedPdf; api: ToolApi; startTool: Tool }) {
  const [sizes, setSizes] = useState<Size[]>([]);
  const [annots, setAnnots] = useState<Annot[]>([]);
  const [history, setHistory] = useState<Annot[][]>([]);
  const [tool, setTool] = useState<Tool>(startTool === 'sign' ? 'select' : startTool);
  const [selected, setSelected] = useState<number | null>(null);
  const [color, setColor] = useState('#1a1a1a');
  const [fontSize, setFontSize] = useState(16);
  const [textFont, setTextFont] = useState<TextFont>('sans');
  const [bold, setBold] = useState(false);
  const [stroke, setStroke] = useState(2);
  const [pending, setPending] = useState<Pending | null>(null);
  const [sigOpen, setSigOpen] = useState(startTool === 'sign');
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [epoch, setEpoch] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const scale = fitScale * zoom;

  useEffect(() => {
    (async () => {
      const out: Size[] = [];
      for (let i = 1; i <= pdf.doc.numPages; i++) {
        const p = await pdf.doc.getPage(i);
        const vp = p.getViewport({ scale: 1, rotation: p.rotate });
        out.push({ w: vp.width, h: vp.height });
      }
      setSizes(out);
    })();
  }, [pdf]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !sizes.length) return;
    const maxW = Math.max(...sizes.map((s) => s.w));
    const ro = new ResizeObserver(() => setFitScale(Math.min(1.6, (el.clientWidth - 48) / maxW)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sizes]);

  const commit = useCallback((next: Annot[] | ((prev: Annot[]) => Annot[])) => {
    setAnnots((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      if (value !== prev) setHistory((h) => [...h.slice(-49), prev]);
      return value;
    });
  }, []);
  /** Update without a history entry (used while dragging / typing). */
  const patch = (id: number, fn: (a: Annot) => Annot) => setAnnots((prev) => prev.map((a) => (a.id === id ? fn(a) : a)));
  const snapshot = () => setHistory((h) => [...h.slice(-49), annots]);

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      setAnnots(h[h.length - 1]);
      setEpoch((e) => e + 1);
      setSelected(null);
      return h.slice(0, -1);
    });
  };
  const remove = (id: number) => { commit((prev) => prev.filter((a) => a.id !== id)); setSelected(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const editing = (e.target as HTMLElement)?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !editing) { e.preventDefault(); undo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null && !editing) { e.preventDefault(); remove(selected); }
      if (e.key === 'Escape') { setSelected(null); setPending(null); (document.activeElement as HTMLElement)?.blur?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Reflect toolbar style changes onto the selected annotation.
  const sel = annots.find((a) => a.id === selected);
  const setStyle = (k: 'color' | 'size' | 'font' | 'bold' | 'width', v: string | number | boolean) => {
    if (k === 'color') setColor(v as string);
    if (k === 'size') setFontSize(v as number);
    if (k === 'font') setTextFont(v as TextFont);
    if (k === 'bold') setBold(v as boolean);
    if (k === 'width') setStroke(v as number);
    if (!sel) return;
    commit((prev) => prev.map((a) => {
      if (a.id !== sel.id) return a;
      if (a.type === 'text') return { ...a, ...(k === 'color' && { color: v as string }), ...(k === 'size' && { size: v as number }), ...(k === 'font' && { font: v as TextFont }), ...(k === 'bold' && { bold: v as boolean }) };
      if (a.type === 'path') return { ...a, ...(k === 'color' && { color: v as string }), ...(k === 'width' && { width: v as number }) };
      if (a.type === 'rect' && k === 'color' && a.color !== '#ffffff') return { ...a, color: v as string };
      return a;
    }));
  };

  const pickTool = (t: Tool) => {
    setSelected(null);
    if (t === 'image') { imageInput.current?.click(); return; }
    if (t === 'sign') { setSigOpen(true); return; }
    setPending(null);
    setTool(t);
  };

  const place = (page: number, x: number, y: number) => {
    if (!pending) return;
    const s = sizes[page];
    const w = Math.min(pending.w, s.w * 0.9), h = (w / pending.w) * pending.h;
    const a: Annot = { id: nextId++, page, type: 'image', x: clamp(x - w / 2, 0, s.w - w), y: clamp(y - h / 2, 0, s.h - h), w, h, src: pending.src };
    commit((prev) => [...prev, a]);
    setSelected(a.id);
    setPending(null);
    setTool('select');
  };

  const onDraftDone = (d: Draft) => {
    const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
    let a: Annot | null = null;
    if (tool === 'pen' && d.points && d.points.length >= 4) a = { id: nextId++, page: d.page, type: 'path', points: d.points, color, width: stroke };
    else if (tool === 'pen' && d.points) a = { id: nextId++, page: d.page, type: 'path', points: [...d.points, d.points[0] + 0.1, d.points[1] + 0.1], color, width: stroke };
    else if (tool === 'text') {
      a = { id: nextId++, page: d.page, type: 'text', x: d.x0, y: d.y0 - fontSize * 0.6, text: '', size: fontSize, color, font: textFont, bold };
    } else if (w > 3 && h > 3) {
      if (tool === 'whiteout') a = { id: nextId++, page: d.page, type: 'rect', x, y, w, h, color: '#ffffff', opacity: 1 };
      if (tool === 'highlight') a = { id: nextId++, page: d.page, type: 'rect', x, y, w, h, color: '#ffe066', opacity: 0.45 };
      if (tool === 'rect') a = { id: nextId++, page: d.page, type: 'rect', x, y, w, h, color, opacity: 1, border: true };
    }
    if (!a) return;
    commit((prev) => [...prev, a!]);
    if (tool !== 'pen') { setSelected(a.id); }
    if (tool === 'text') setTool('select');
  };

  const save = () => api.run(async () => {
    const clean = annots.filter((a) => a.type !== 'text' || a.text.trim());
    return [{ name: `${baseName(pdf.file.name)}-edited.pdf`, data: await applyAnnotations(pdf.bytes, clean) }];
  });

  const showText = tool === 'text' || sel?.type === 'text';
  const showStroke = tool === 'pen' || sel?.type === 'path';

  return (
    <div className="editor">
      <div className="editor-bar">
        <div className="tool-group">
          {TOOLBAR.map((t) => (
            <button key={t.id} className={`tool-btn${(tool === t.id && !pending) || (pending && t.id === 'image') ? ' active' : ''}`} onClick={() => pickTool(t.id)} title={t.label}>
              <Icon name={t.icon} size={20} /><span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="tool-group">
          <label className="color-pick" title="Colour"><input type="color" value={color} onChange={(e) => setStyle('color', e.target.value)} /></label>
          {showText && <>
            <select value={textFont} onChange={(e) => setStyle('font', e.target.value)} title="Font">
              <option value="sans">Helvetica</option><option value="serif">Times</option><option value="mono">Courier</option>
            </select>
            <select value={sel?.type === 'text' ? sel.size : fontSize} onChange={(e) => setStyle('size', +e.target.value)} title="Font size">
              {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className={`tool-btn small${(sel?.type === 'text' ? sel.bold : bold) ? ' active' : ''}`} onClick={() => setStyle('bold', !(sel?.type === 'text' ? sel.bold : bold))}><b>B</b></button>
          </>}
          {showStroke && (
            <select value={sel?.type === 'path' ? sel.width : stroke} onChange={(e) => setStyle('width', +e.target.value)} title="Stroke width">
              {[1, 2, 3, 5, 8, 12].map((s) => <option key={s} value={s}>{s}px</option>)}
            </select>
          )}
          <button className="tool-btn" onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)"><Icon name="undo" size={20} /></button>
          <button className="tool-btn" onClick={() => selected !== null && remove(selected)} disabled={selected === null} title="Delete (Del)"><Icon name="remove" size={20} /></button>
          <span className="zoom">
            <button onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(1)))}>−</button>
            {Math.round(zoom * 100)}%
            <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))}>+</button>
          </span>
          <button className="btn btn-primary" onClick={save} disabled={api.busy || !annots.length}>Save PDF <span aria-hidden>→</span></button>
        </div>
      </div>
      {pending && <div className="place-hint">Click on a page to place it · <button className="btn-link" onClick={() => setPending(null)}>Cancel</button></div>}
      <div className="editor-scroll" ref={scroller}>
        {sizes.map((s, i) => (
          <EditorPage key={i} doc={pdf.doc} index={i} size={s} scale={scale} tool={pending ? 'place' : tool}
            annots={annots.filter((a) => a.page === i)} selected={selected} epoch={epoch} pen={{ color, width: stroke }}
            onSelect={setSelected} onPlace={(x, y) => place(i, x, y)} onDraftDone={onDraftDone}
            onPatch={patch} onSnapshot={snapshot} onRemove={remove} />
        ))}
      </div>
      <input ref={imageInput} type="file" accept="image/png,image/jpeg" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        const src = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); });
        const img = new Image();
        img.src = src;
        await img.decode();
        setPending({ src, w: Math.min(200, img.naturalWidth * 0.75), h: Math.min(200, img.naturalWidth * 0.75) * (img.naturalHeight / img.naturalWidth) });
      }} />
      {sigOpen && <SignaturePad onCancel={() => setSigOpen(false)} onDone={(src, w, h) => {
        setSigOpen(false);
        const pw = 160;
        setPending({ src, w: pw, h: pw * (h / w) });
      }} />}
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

type PageProps = {
  doc: PDFDocumentProxy; index: number; size: Size; scale: number; tool: Tool | 'place';
  annots: Annot[]; selected: number | null; epoch: number; pen: { color: string; width: number };
  onSelect: (id: number | null) => void; onPlace: (x: number, y: number) => void; onDraftDone: (d: Draft) => void;
  onPatch: (id: number, fn: (a: Annot) => Annot) => void; onSnapshot: () => void; onRemove: (id: number) => void;
};

function EditorPage({ doc, index, size, scale, tool, annots, selected, epoch, pen, onSelect, onPlace, onDraftDone, onPatch, onSnapshot, onRemove }: PageProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const drag = useRef<{ id: number; mode: 'move' | 'resize'; sx: number; sy: number; orig: Annot } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(index + 1);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = await renderPage(page, { scale: scale * dpr });
      if (cancelled) return;
      c.className = 'page-canvas';
      canvasHost.current?.replaceChildren(c);
    })().catch((e) => !cancelled && console.error(e));
    return () => { cancelled = true; };
  }, [visible, doc, index, scale]);

  const toPt = (e: { clientX: number; clientY: number }) => {
    const r = host.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / scale, 0, size.w), y: clamp((e.clientY - r.top) / scale, 0, size.h) };
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-annot]');
    if (target) return; // handled by the annotation itself
    const p = toPt(e);
    if (tool === 'place') { onPlace(p.x, p.y); return; }
    if (tool === 'select') { onSelect(null); (document.activeElement as HTMLElement)?.blur?.(); return; }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDraft({ page: index, x0: p.x, y0: p.y, x1: p.x, y1: p.y, points: tool === 'pen' ? [p.x, p.y] : undefined });
    if (tool === 'text') e.preventDefault();
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag.current) { dragMove(e); return; }
    if (!draft) return;
    const p = toPt(e);
    setDraft({ ...draft, x1: p.x, y1: p.y, points: draft.points ? [...draft.points, p.x, p.y] : undefined });
  };
  const onUp = (e: React.PointerEvent) => {
    if (drag.current) { drag.current = null; return; }
    if (!draft) return;
    const p = toPt(e);
    onDraftDone({ ...draft, x1: p.x, y1: p.y });
    setDraft(null);
  };

  const startDrag = (e: React.PointerEvent, a: Annot, mode: 'move' | 'resize') => {
    e.stopPropagation();
    if (e.button !== 0) return;
    onSelect(a.id);
    onSnapshot();
    host.current!.setPointerCapture(e.pointerId);
    const p = toPt(e);
    drag.current = { id: a.id, mode, sx: p.x, sy: p.y, orig: a };
  };
  const dragMove = (e: React.PointerEvent) => {
    const d = drag.current!;
    const p = toPt(e);
    const dx = p.x - d.sx, dy = p.y - d.sy;
    onPatch(d.id, () => {
      const o = d.orig;
      if (o.type === 'path') {
        return { ...o, points: o.points.map((v, i) => v + (i % 2 ? dy : dx)) };
      }
      if (d.mode === 'resize' && (o.type === 'rect' || o.type === 'image')) {
        const w = Math.max(8, o.w + dx);
        const h = o.type === 'image' ? w * (o.h / o.w) : Math.max(8, o.h + dy);
        return { ...o, w, h };
      }
      return { ...o, x: o.x + dx, y: o.y + dy };
    });
  };

  const interactive = tool === 'select';
  const s = scale;

  return (
    <div className="page-wrap" style={{ width: size.w * s, height: size.h * s }}>
      <div ref={canvasHost} className="page-canvas-host" />
      <div ref={host} className={`page-overlay tool-${tool}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
        <svg className="page-svg" width={size.w * s} height={size.h * s}>
          {annots.filter((a) => a.type === 'path').map((a) => a.type === 'path' && (
            <g key={a.id} data-annot={a.id} className={`svg-annot${selected === a.id ? ' sel' : ''}${interactive ? ' live' : ''}`}
              onPointerDown={(e) => interactive && startDrag(e, a, 'move')}>
              <polyline points={pairs(a.points, s)} fill="none" stroke="transparent" strokeWidth={Math.max(12, a.width * s + 8)} strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={pairs(a.points, s)} fill="none" stroke={a.color} strokeWidth={a.width * s} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
          {draft?.points && <polyline points={pairs(draft.points, s)} fill="none" stroke={pen.color} strokeWidth={pen.width * s} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        {annots.map((a) => {
          if (a.type === 'path') return null;
          const isSel = selected === a.id;
          if (a.type === 'text') {
            return (
              <div key={`${a.id}-${epoch}`} data-annot={a.id} className={`annot text-annot${isSel ? ' sel' : ''}`}
                style={{ left: a.x * s, top: a.y * s, fontSize: a.size * s, color: a.color, fontFamily: CSS_FONTS[a.font], fontWeight: a.bold ? 700 : 400, lineHeight: LINE_HEIGHT }}
                onPointerDown={(e) => { e.stopPropagation(); onSelect(a.id); }}>
                <div className="grip" onPointerDown={(e) => startDrag(e, a, 'move')} title="Drag to move">⠿</div>
                <TextEditable annot={a} autoFocus={!a.text} onChange={(text) => onPatch(a.id, (o) => ({ ...o, text } as Annot))}
                  onBlur={() => !a.text.trim() && onRemove(a.id)} />
              </div>
            );
          }
          const style = { left: a.x * s, top: a.y * s, width: a.w * s, height: a.h * s };
          return (
            <div key={a.id} data-annot={a.id} className={`annot box-annot${isSel ? ' sel' : ''}${interactive ? ' live' : ''}`} style={style}
              onPointerDown={(e) => interactive && startDrag(e, a, 'move')}>
              {a.type === 'rect' && <div className="rect-fill" style={a.border ? { border: `${2 * s}px solid ${a.color}`, opacity: a.opacity } : { background: a.color, opacity: a.opacity, mixBlendMode: a.opacity < 1 ? 'multiply' : undefined }} />}
              {a.type === 'image' && <img src={a.src} alt="" draggable={false} />}
              {isSel && interactive && <div className="resize" onPointerDown={(e) => startDrag(e, a, 'resize')} />}
            </div>
          );
        })}
        {draft && !draft.points && tool !== 'text' && (
          <div className={`draft draft-${tool}`} style={{ left: Math.min(draft.x0, draft.x1) * s, top: Math.min(draft.y0, draft.y1) * s, width: Math.abs(draft.x1 - draft.x0) * s, height: Math.abs(draft.y1 - draft.y0) * s }} />
        )}
      </div>
      <div className="page-label">{index + 1}</div>
    </div>
  );
}

function pairs(points: number[], s: number) {
  let out = '';
  for (let i = 0; i < points.length; i += 2) out += `${points[i] * s},${points[i + 1] * s} `;
  return out;
}

/** Uncontrolled contentEditable so the caret doesn't jump while typing. */
function TextEditable({ annot, autoFocus, onChange, onBlur }: { annot: Extract<Annot, { type: 'text' }>; autoFocus: boolean; onChange: (t: string) => void; onBlur: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    el.innerText = annot.text;
    if (autoFocus) el.focus();
  }, []);
  return (
    <div ref={ref} className="text-edit" contentEditable="plaintext-only" suppressContentEditableWarning spellCheck={false}
      data-placeholder="Type here"
      onInput={(e) => onChange((e.target as HTMLDivElement).innerText.replace(/\n$/, ''))}
      onBlur={onBlur} />
  );
}

function makeEditor(id: 'edit' | 'sign') {
  const tool = toolById(id)!;
  return function EditorTool() {
    return (
      <ToolShell tool={tool} filter={isPdf}>
        {(api) => <SinglePdf file={api.files[0]} onReset={api.reset}>{(pdf) => <EditorView pdf={pdf} api={api} startTool={id === 'sign' ? 'sign' : 'text'} />}</SinglePdf>}
      </ToolShell>
    );
  };
}

export const EditPdf = makeEditor('edit');
export const SignPdf = makeEditor('sign');
