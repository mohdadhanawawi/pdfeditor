import { useEffect, useRef, useState } from 'react';
import { renderPage, type PDFDocumentProxy } from '../lib/pdf';

/** Lazily renders a page thumbnail once it scrolls into view. */
export function PageThumb({ doc, index, rotation = 0, width = 150 }: {
  doc: PDFDocumentProxy;
  index: number;
  rotation?: number;
  width?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(index + 1);
      const c = await renderPage(page, { maxWidth: width * Math.min(2, window.devicePixelRatio || 1) });
      if (!cancelled) setCanvas(c);
    })().catch(console.error);
    return () => { cancelled = true; };
  }, [visible, doc, index, width]);

  useEffect(() => {
    const el = host.current;
    if (!el || !canvas) return;
    canvas.className = 'thumb-canvas';
    el.replaceChildren(canvas);
  }, [canvas]);

  return (
    <div className="thumb-frame" style={{ width, height: width * 1.3 }}>
      <div ref={host} className="thumb-inner" style={{ transform: `rotate(${rotation}deg)` }}>
        <div className="thumb-placeholder" />
      </div>
    </div>
  );
}
