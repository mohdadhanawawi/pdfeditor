import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { ToolShell, Workspace } from '../components/ToolShell';
import { Dropzone } from '../components/Dropzone';
import { PageThumb } from '../components/PageThumb';
import { Icon } from '../components/Icon';
import { usePdf } from '../components/usePdf';
import { formatBytes, isPdf, objKey, readFile } from '../lib/pdf';
import { toolById } from './registry';

const tool = toolById('merge')!;

function FileCard({ file, index, total, onMove, onRemove }: {
  file: File; index: number; total: number;
  onMove: (from: number, to: number) => void; onRemove: () => void;
}) {
  const { pdf, error } = usePdf(file);
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
      {pdf ? <PageThumb doc={pdf.doc} index={0} width={140} /> : <div className="thumb-frame" style={{ width: 140, height: 182 }}>{error ? <span className="err-small">{error}</span> : <div className="thumb-placeholder" />}</div>}
      <div className="file-name" title={file.name}>{file.name}</div>
      <div className="muted small">{pdf ? `${pdf.doc.numPages} pages · ` : ''}{formatBytes(file.size)}</div>
    </div>
  );
}

export default function Merge() {
  return (
    <ToolShell tool={tool} multiple filter={isPdf}>
      {({ files, setFiles, run, busy, setProgress }) => {
        const move = (from: number, to: number) => setFiles((prev) => {
          if (from === to || to < 0 || to >= prev.length) return prev;
          const next = [...prev];
          const [f] = next.splice(from, 1);
          next.splice(to, 0, f);
          return next;
        });
        return (
          <MergeWorkspace files={files} busy={busy}
            onAdd={(f) => setFiles((prev) => [...prev, ...f])}
            onMove={move}
            onRemove={(i) => setFiles((prev) => prev.filter((_, j) => j !== i))}
            onSort={(dir) => setFiles((prev) => [...prev].sort((a, b) => dir * a.name.localeCompare(b.name, undefined, { numeric: true })))}
            onMerge={() => run(async () => {
              const out = await PDFDocument.create();
              for (const [i, f] of files.entries()) {
                setProgress(`Merging ${i + 1} of ${files.length}: ${f.name}`);
                const src = await PDFDocument.load(await readFile(f), { ignoreEncryption: true });
                const pages = await out.copyPages(src, src.getPageIndices());
                pages.forEach((p) => out.addPage(p));
              }
              return [{ name: 'merged.pdf', data: await out.save() }];
            })} />
        );
      }}
    </ToolShell>
  );
}

function MergeWorkspace({ files, busy, onAdd, onMove, onRemove, onSort, onMerge }: {
  files: File[]; busy: boolean;
  onAdd: (f: File[]) => void; onMove: (a: number, b: number) => void; onRemove: (i: number) => void;
  onSort: (dir: 1 | -1) => void; onMerge: () => void;
}) {
  const [dir, setDir] = useState<1 | -1>(1);
  return (
    <Workspace title="Merge PDF" action="Merge PDF" onAction={onMerge} busy={busy} disabled={files.length < 2}
      sidebar={<>
        <p className="muted">Drag the cards or use the arrows to set the order. Files are merged left to right.</p>
        <button className="btn btn-ghost btn-block" onClick={() => { onSort(dir); setDir(dir === 1 ? -1 : 1); }}>
          Sort by name {dir === 1 ? 'A→Z' : 'Z→A'}
        </button>
        {files.length < 2 && <p className="hint">Add at least two PDFs to merge.</p>}
      </>}>
      <div className="toolbar"><Dropzone compact accept="application/pdf,.pdf" multiple label="Add more files" onFiles={onAdd} /></div>
      <div className="card-grid">
        {files.map((f, i) => (
          <FileCard key={objKey(f)} file={f} index={i} total={files.length}
            onMove={onMove} onRemove={() => onRemove(i)} />
        ))}
      </div>
    </Workspace>
  );
}
