import { useMemo, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { ToolShell, Workspace, type ToolApi } from '../components/ToolShell';
import { SinglePdf } from '../components/SinglePdf';
import { PageThumb } from '../components/PageThumb';
import { baseName, isPdf } from '../lib/pdf';
import { describePages, parseRanges } from '../lib/ranges';
import type { LoadedPdf } from '../components/usePdf';
import { toolById } from './registry';

const tool = toolById('split')!;
type Mode = 'ranges' | 'every' | 'fixed';

function SplitView({ pdf, api }: { pdf: LoadedPdf; api: ToolApi }) {
  const n = pdf.doc.numPages;
  const [mode, setMode] = useState<Mode>('ranges');
  const [ranges, setRanges] = useState(n > 1 ? `1-${Math.ceil(n / 2)}, ${Math.ceil(n / 2) + 1}-${n}` : '1');
  const [chunk, setChunk] = useState(2);

  const { groups, error } = useMemo(() => {
    try {
      if (mode === 'every') return { groups: Array.from({ length: n }, (_, i) => [i]) };
      if (mode === 'fixed') {
        const size = Math.max(1, chunk || 1);
        const g: number[][] = [];
        for (let i = 0; i < n; i += size) g.push(Array.from({ length: Math.min(size, n - i) }, (_, k) => i + k));
        return { groups: g };
      }
      return { groups: parseRanges(ranges, n) };
    } catch (e) {
      return { groups: [] as number[][], error: (e as Error).message };
    }
  }, [mode, ranges, chunk, n]);

  const stem = baseName(pdf.file.name);

  return (
    <Workspace title="Split PDF" action="Split PDF" busy={api.busy} disabled={!groups.length}
      onAction={() => api.run(async () => {
        const src = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true });
        const out = [];
        for (const [i, g] of groups.entries()) {
          api.setProgress(`Creating file ${i + 1} of ${groups.length}`);
          const doc = await PDFDocument.create();
          (await doc.copyPages(src, g)).forEach((p) => doc.addPage(p));
          out.push({ name: `${stem}-${describePages(g).replace(/, /g, '_')}.pdf`, data: await doc.save() });
        }
        return out;
      }, `${stem}-split.zip`)}
      sidebar={<>
        <div className="segmented">
          {(['ranges', 'fixed', 'every'] as Mode[]).map((m) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
              {m === 'ranges' ? 'Custom ranges' : m === 'fixed' ? 'Fixed size' : 'Every page'}
            </button>
          ))}
        </div>
        {mode === 'ranges' && (
          <label className="field"><span>Page ranges (each becomes one file)</span>
            <input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 4-6, 7" />
          </label>
        )}
        {mode === 'fixed' && (
          <label className="field"><span>Pages per file</span>
            <input type="number" min={1} max={n} value={chunk} onChange={(e) => setChunk(parseInt(e.target.value, 10))} />
          </label>
        )}
        {error ? <p className="hint">{error}</p> : <p>This creates <strong>{groups.length}</strong> PDF{groups.length === 1 ? '' : 's'}{groups.length > 1 ? ', downloaded as a ZIP' : ''}.</p>}
      </>}>
      <div className="split-groups">
        {groups.slice(0, 60).map((g, i) => (
          <div className="split-group" key={i}>
            <div className="split-label">File {i + 1} · pages {describePages(g)}</div>
            <div className="row gap">
              <PageThumb doc={pdf.doc} index={g[0]} width={100} />
              {g.length > 1 && <><span className="muted">…</span><PageThumb doc={pdf.doc} index={g[g.length - 1]} width={100} /></>}
            </div>
          </div>
        ))}
        {groups.length > 60 && <p className="muted">…and {groups.length - 60} more</p>}
      </div>
    </Workspace>
  );
}

export default function Split() {
  return (
    <ToolShell tool={tool} filter={isPdf}>
      {(api) => <SinglePdf file={api.files[0]} onReset={api.reset}>{(pdf) => <SplitView pdf={pdf} api={api} />}</SinglePdf>}
    </ToolShell>
  );
}
