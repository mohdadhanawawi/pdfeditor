import type { ReactNode } from 'react';
import { usePdf, type LoadedPdf } from './usePdf';

/** Loads the first selected file and renders children once it is ready. */
export function SinglePdf({ file, onReset, children }: { file: File; onReset: () => void; children: (pdf: LoadedPdf) => ReactNode }) {
  const { pdf, error, loading } = usePdf(file);
  if (loading) return <div className="center-box"><div className="spinner" /><p>Opening {file.name}…</p></div>;
  if (error || !pdf) {
    return (
      <div className="center-box">
        <p className="error-text">{error ?? 'Could not open this file.'}</p>
        <button className="btn btn-ghost" onClick={onReset}>Choose another file</button>
      </div>
    );
  }
  return <>{children(pdf)}</>;
}
