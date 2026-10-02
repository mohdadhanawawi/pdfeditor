import { useState } from 'react';
import { ToolShell, Workspace } from '../components/ToolShell';
import { SinglePdf } from '../components/SinglePdf';
import { PageGrid, type GridPage } from '../components/PageGrid';
import { Icon } from '../components/Icon';
import { buildFromPlan } from '../lib/build';
import { baseName, isPdf } from '../lib/pdf';
import type { LoadedPdf } from '../components/usePdf';
import type { ToolApi } from '../components/ToolShell';
import { toolById } from './registry';

const tool = toolById('organize')!;

function OrganizeView({ pdf, api }: { pdf: LoadedPdf; api: ToolApi }) {
  const initial = () => Array.from({ length: pdf.doc.numPages }, (_, i) => ({ key: i, index: i, rotation: 0 }));
  const [pages, setPages] = useState<GridPage[]>(initial);

  const update = (pos: number, fn: (p: GridPage) => GridPage | null) =>
    setPages((prev) => prev.flatMap((p, i) => (i === pos ? (fn(p) ?? []) : [p])));
  const reorder = (from: number, to: number) => setPages((prev) => {
    const next = [...prev];
    const [p] = next.splice(from, 1);
    next.splice(to, 0, p);
    return next;
  });

  return (
    <Workspace title="Organize PDF" action="Save changes" busy={api.busy} disabled={!pages.length}
      onAction={() => api.run(async () => [{
        name: `${baseName(pdf.file.name)}-organized.pdf`,
        data: await buildFromPlan(pdf.bytes, pages.map((p) => ({ index: p.index, rotation: p.rotation }))),
      }])}
      sidebar={<>
        <p className="muted">Drag pages (or use the arrows) to reorder them. Use the buttons on each page to rotate or delete it.</p>
        <p><strong>{pages.length}</strong> of {pdf.doc.numPages} pages kept</p>
        <button className="btn btn-ghost btn-block" onClick={() => setPages(initial())}><Icon name="undo" size={18} /> Reset</button>
        <button className="btn btn-ghost btn-block" onClick={() => setPages((p) => [...p].reverse())}>Reverse order</button>
      </>}>
      <PageGrid doc={pdf.doc} pages={pages} onReorder={reorder}
        footer={(pos) => <>
          <button title="Move earlier" disabled={pos === 0} onClick={() => reorder(pos, pos - 1)}><Icon name="up" size={14} /></button>
          <button title="Move later" disabled={pos === pages.length - 1} onClick={() => reorder(pos, pos + 1)}><Icon name="down" size={14} /></button>
        </>}
        controls={(pos) => <>
          <button title="Rotate left" onClick={() => update(pos, (p) => ({ ...p, rotation: (p.rotation ?? 0) - 90 }))}><Icon name="undo" size={14} /></button>
          <button title="Rotate right" onClick={() => update(pos, (p) => ({ ...p, rotation: (p.rotation ?? 0) + 90 }))}><Icon name="rotate" size={14} /></button>
          <button title="Delete page" onClick={() => update(pos, () => null)}><Icon name="close" size={14} /></button>
        </>} />
    </Workspace>
  );
}

export default function Organize() {
  return (
    <ToolShell tool={tool} filter={isPdf}>
      {(api) => <SinglePdf file={api.files[0]} onReset={api.reset}>{(pdf) => <OrganizeView pdf={pdf} api={api} />}</SinglePdf>}
    </ToolShell>
  );
}
