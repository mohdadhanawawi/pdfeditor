import { useState } from 'react';
import { ToolShell, Workspace, type ToolApi } from '../components/ToolShell';
import { SinglePdf } from '../components/SinglePdf';
import { PageGrid } from '../components/PageGrid';
import { Icon } from '../components/Icon';
import { buildFromPlan } from '../lib/build';
import { baseName, isPdf } from '../lib/pdf';
import type { LoadedPdf } from '../components/usePdf';
import { toolById } from './registry';

const tool = toolById('rotate')!;

function RotateView({ pdf, api }: { pdf: LoadedPdf; api: ToolApi }) {
  const [rot, setRot] = useState<number[]>(() => Array(pdf.doc.numPages).fill(0));
  const pages = rot.map((r, i) => ({ key: i, index: i, rotation: r }));
  const turn = (pos: number | 'all', by: number) => setRot((prev) => prev.map((r, i) => (pos === 'all' || pos === i ? r + by : r)));

  return (
    <Workspace title="Rotate PDF" action="Rotate PDF" busy={api.busy} disabled={rot.every((r) => r % 360 === 0)}
      onAction={() => api.run(async () => [{
        name: `${baseName(pdf.file.name)}-rotated.pdf`,
        data: await buildFromPlan(pdf.bytes, pages.map((p) => ({ index: p.index, rotation: p.rotation }))),
      }])}
      sidebar={<>
        <p className="muted">Rotate all pages at once, or hover a page to rotate just that one.</p>
        <div className="row gap">
          <button className="btn btn-ghost grow" onClick={() => turn('all', -90)}><Icon name="undo" size={18} /> Left</button>
          <button className="btn btn-ghost grow" onClick={() => turn('all', 90)}><Icon name="rotate" size={18} /> Right</button>
        </div>
        <button className="btn btn-link" onClick={() => setRot(Array(pdf.doc.numPages).fill(0))}>Reset all</button>
      </>}>
      <PageGrid doc={pdf.doc} pages={pages} onToggle={(pos) => turn(pos, 90)}
        controls={(pos) => <>
          <button title="Rotate left" onClick={() => turn(pos, -90)}><Icon name="undo" size={14} /></button>
          <button title="Rotate right" onClick={() => turn(pos, 90)}><Icon name="rotate" size={14} /></button>
        </>} />
    </Workspace>
  );
}

export default function Rotate() {
  return (
    <ToolShell tool={tool} filter={isPdf}>
      {(api) => <SinglePdf file={api.files[0]} onReset={api.reset}>{(pdf) => <RotateView pdf={pdf} api={api} />}</SinglePdf>}
    </ToolShell>
  );
}
