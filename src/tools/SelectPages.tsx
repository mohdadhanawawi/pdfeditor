import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { ToolShell, Workspace, type ToolApi } from '../components/ToolShell';
import { SinglePdf } from '../components/SinglePdf';
import { PageGrid, toggleWithRange } from '../components/PageGrid';
import { buildFromPlan } from '../lib/build';
import { baseName, isPdf } from '../lib/pdf';
import { describePages, parseRanges } from '../lib/ranges';
import type { LoadedPdf } from '../components/usePdf';
import { toolById } from './registry';

type Mode = 'remove' | 'extract';

function SelectView({ pdf, api, mode }: { pdf: LoadedPdf; api: ToolApi; mode: Mode }) {
  const n = pdf.doc.numPages;
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [last, setLast] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [separate, setSeparate] = useState(false);
  const pages = Array.from({ length: n }, (_, i) => ({ key: i, index: i }));
  const keep = mode === 'remove' ? pages.filter((p) => !sel.has(p.index)) : pages.filter((p) => sel.has(p.index));

  const applyText = (v: string) => {
    setText(v);
    try { setSel(new Set(parseRanges(v, n).flat())); } catch { /* keep typing */ }
  };

  const stem = baseName(pdf.file.name);
  const action = mode === 'remove' ? 'Remove pages' : 'Extract pages';

  return (
    <Workspace title={action} action={action} busy={api.busy}
      disabled={!sel.size || (mode === 'remove' && sel.size === n)}
      onAction={() => api.run(async () => {
        if (mode === 'extract' && separate) {
          const src = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true });
          return Promise.all(keep.map(async (p) => {
            const out = await PDFDocument.create();
            const [pg] = await out.copyPages(src, [p.index]);
            out.addPage(pg);
            return { name: `${stem}-page-${p.index + 1}.pdf`, data: await out.save() };
          }));
        }
        return [{ name: `${stem}-${mode === 'remove' ? 'removed' : 'extracted'}.pdf`, data: await buildFromPlan(pdf.bytes, keep) }];
      }, `${stem}-pages.zip`)}
      sidebar={<>
        <p className="muted">Click pages to {mode === 'remove' ? 'mark them for removal' : 'select them'}. Shift-click selects a range.</p>
        <label className="field">
          <span>Pages to {mode}</span>
          <input value={text} placeholder="e.g. 1-3, 7, 10-" onChange={(e) => applyText(e.target.value)} />
        </label>
        <div className="row gap">
          <button className="btn btn-ghost grow" onClick={() => { setSel(new Set(pages.map((p) => p.index))); setText(`1-${n}`); }}>All</button>
          <button className="btn btn-ghost grow" onClick={() => { setSel(new Set()); setText(''); }}>None</button>
        </div>
        {mode === 'extract' && (
          <label className="check-row"><input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} /> Save each page as a separate PDF</label>
        )}
        <p>{sel.size ? <>Selected: <strong>{describePages([...sel])}</strong><br /></> : null}Result: <strong>{keep.length}</strong> page{keep.length === 1 ? '' : 's'}</p>
        {mode === 'remove' && sel.size === n && <p className="hint">You can't remove every page.</p>}
      </>}>
      <PageGrid doc={pdf.doc} pages={pages} selected={sel} selectStyle={mode === 'remove' ? 'remove' : 'select'}
        onToggle={(pos, e) => {
          const next = toggleWithRange(sel, pos, e.shiftKey, last);
          setSel(next); setLast(pos); setText(next.size ? describePages([...next]) : '');
        }} />
    </Workspace>
  );
}

function makeTool(mode: Mode) {
  const tool = toolById(mode)!;
  return function SelectPagesTool() {
    return (
      <ToolShell tool={tool} filter={isPdf}>
        {(api) => <SinglePdf file={api.files[0]} onReset={api.reset}>{(pdf) => <SelectView pdf={pdf} api={api} mode={mode} />}</SinglePdf>}
      </ToolShell>
    );
  };
}

export const RemovePages = makeTool('remove');
export const ExtractPages = makeTool('extract');
