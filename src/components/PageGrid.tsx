import type { ReactNode } from 'react';
import { PageThumb } from './PageThumb';
import type { PDFDocumentProxy } from '../lib/pdf';

export type GridPage = { key: string | number; index: number; rotation?: number };

/** Grid of page thumbnails with click-to-select and optional per-card controls / drag reorder. */
export function PageGrid({ doc, pages, selected, onToggle, controls, footer, onReorder, selectStyle = 'select' }: {
  doc: PDFDocumentProxy;
  pages: GridPage[];
  selected?: Set<number>;
  onToggle?: (pos: number, e: React.MouseEvent) => void;
  controls?: (pos: number) => ReactNode;
  /** Always-visible-on-touch controls under the thumbnail (e.g. move buttons, since HTML5 drag doesn't work on phones). */
  footer?: (pos: number) => ReactNode;
  onReorder?: (from: number, to: number) => void;
  selectStyle?: 'select' | 'remove';
}) {
  return (
    <div className="card-grid">
      {pages.map((p, pos) => {
        const isSel = selected?.has(pos);
        return (
          <div key={p.key}
            className={`page-card${isSel ? ` selected ${selectStyle}` : ''}${onToggle ? ' clickable' : ''}`}
            draggable={!!onReorder}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', String(pos))}
            onDragOver={(e) => onReorder && e.preventDefault()}
            onDrop={(e) => { if (!onReorder) return; e.preventDefault(); onReorder(Number(e.dataTransfer.getData('text/plain')), pos); }}
            onClick={(e) => onToggle?.(pos, e)}>
            {controls && <div className="card-tools" onClick={(e) => e.stopPropagation()}>{controls(pos)}</div>}
            <PageThumb doc={doc} index={p.index} rotation={p.rotation} width={130} />
            <div className="page-no">{p.index + 1}</div>
            {footer && <div className="card-foot" onClick={(e) => e.stopPropagation()}>{footer(pos)}</div>}
            {isSel && <div className="check">{selectStyle === 'remove' ? '✕' : '✓'}</div>}
          </div>
        );
      })}
    </div>
  );
}

/** Shift-click range selection helper. */
export function toggleWithRange(prev: Set<number>, pos: number, shift: boolean, last: number | null) {
  const next = new Set(prev);
  if (shift && last !== null) {
    const [a, b] = last < pos ? [last, pos] : [pos, last];
    for (let i = a; i <= b; i++) next.add(i);
  } else if (next.has(pos)) next.delete(pos);
  else next.add(pos);
  return next;
}
