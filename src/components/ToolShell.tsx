import { useCallback, useState, type ReactNode } from 'react';
import { Dropzone } from './Dropzone';
import { Icon } from './Icon';
import { downloadBlob, packageOutputs, type OutputFile } from '../lib/download';
import { formatBytes } from '../lib/pdf';
import type { ToolMeta } from '../tools/registry';

export type JobResult = { files: OutputFile[]; note?: string };

export type ToolApi = {
  files: File[];
  setFiles: (f: File[] | ((prev: File[]) => File[])) => void;
  busy: boolean;
  progress: string;
  setProgress: (s: string) => void;
  run: (job: () => Promise<OutputFile[] | JobResult>, zipName?: string) => Promise<void>;
  reset: () => void;
};

type Props = {
  tool: ToolMeta;
  accept?: string;
  multiple?: boolean;
  uploadLabel?: string;
  filter?: (f: File) => boolean;
  children: (api: ToolApi) => ReactNode;
};

type Result = { blob: Blob; name: string; count: number; note?: string };

export function ToolShell({ tool, accept = 'application/pdf,.pdf', multiple, uploadLabel, filter, children }: Props) {
  const [files, setFilesRaw] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const setFiles: ToolApi['setFiles'] = useCallback((f) => {
    setError('');
    setFilesRaw((prev) => {
      const next = typeof f === 'function' ? f(prev) : f;
      const kept = filter ? next.filter(filter) : next;
      if (kept.length < next.length) setError('Some files were skipped because their type is not supported here.');
      return kept;
    });
  }, [filter]);

  const reset = () => { setFilesRaw([]); setResult(null); setError(''); setProgress(''); };

  const run: ToolApi['run'] = async (job, zipName = 'files.zip') => {
    setBusy(true);
    setError('');
    setProgress('Working…');
    try {
      const r = await job();
      const { files: outputs, note } = Array.isArray(r) ? { files: r, note: undefined } : r;
      if (!outputs.length) throw new Error('Nothing to export');
      const pkg = await packageOutputs(outputs, zipName);
      setResult({ ...pkg, count: outputs.length, note });
      downloadBlob(pkg.blob, pkg.name);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  if (result) {
    return (
      <section className="result">
        <h1>Your {result.count > 1 ? 'files are' : 'file is'} ready</h1>
        {result.note && <p className="muted">{result.note}</p>}
        <div className="result-actions">
          <button className="btn btn-primary btn-xl" onClick={() => downloadBlob(result.blob, result.name)}>
            <Icon name="download" size={22} /> Download {result.name.endsWith('.zip') ? 'ZIP' : ''}
          </button>
          <span className="muted">{result.name} · {formatBytes(result.blob.size)}</span>
        </div>
        <div className="row center gap">
          <button className="btn btn-ghost" onClick={() => setResult(null)}>Back to editing</button>
          <button className="btn btn-ghost" onClick={reset}>Start over</button>
          <a className="btn btn-ghost" href="#/">All tools</a>
        </div>
      </section>
    );
  }

  return (
    <>
      {files.length === 0 ? (
        <section className="hero tool-hero">
          <div className="tool-badge" style={{ background: tool.color }}><Icon name={tool.icon} size={34} /></div>
          <h1>{tool.title}</h1>
          <p className="lead">{tool.description}</p>
          <Dropzone accept={accept} multiple={multiple}
            label={uploadLabel ?? (multiple ? 'Select PDF files' : 'Select PDF file')}
            onFiles={(f) => setFiles(f)} />
          <p className="privacy"><Icon name="shield" size={16} /> Processed locally in your browser — files are never uploaded.</p>
        </section>
      ) : (
        children({ files, setFiles, busy, progress, setProgress, run, reset })
      )}
      {error && <div className="toast error" role="alert">{error}<button onClick={() => setError('')}><Icon name="close" size={16} /></button></div>}
      {busy && <div className="overlay"><div className="spinner" /><p>{progress || 'Working…'}</p></div>}
    </>
  );
}

/** Two-column workspace: content on the left, options + action button on the right. */
export function Workspace({ title, children, sidebar, action, onAction, disabled, busy }: {
  title: string;
  children: ReactNode;
  sidebar?: ReactNode;
  action: string;
  onAction: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="workspace">
      <div className="workspace-main">{children}</div>
      <aside className="workspace-side">
        <h2>{title}</h2>
        <div className="side-body">{sidebar}</div>
        <button className="btn btn-primary btn-block btn-lg" disabled={disabled || busy} onClick={onAction}>
          {action} <span aria-hidden>→</span>
        </button>
      </aside>
    </div>
  );
}
