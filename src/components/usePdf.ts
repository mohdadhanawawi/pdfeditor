import { useEffect, useState } from 'react';
import { openPdfJs, readFile, type PDFDocumentProxy } from '../lib/pdf';

export type LoadedPdf = { file: File; bytes: Uint8Array; doc: PDFDocumentProxy };

/** Load a File into both raw bytes (for pdf-lib) and a pdf.js document (for previews). */
export function usePdf(file: File | undefined) {
  const [state, setState] = useState<{ pdf?: LoadedPdf; error?: string; loading: boolean }>({ loading: !!file });

  useEffect(() => {
    if (!file) { setState({ loading: false }); return; }
    let cancelled = false;
    let loading: ReturnType<typeof openPdfJs> | undefined;
    setState({ loading: true });
    (async () => {
      try {
        const bytes = await readFile(file);
        if (cancelled) return;
        loading = openPdfJs(bytes);
        const doc = await loading.promise;
        if (cancelled) return;
        setState({ pdf: { file, bytes, doc }, loading: false });
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: describeLoadError(e) });
      }
    })();
    return () => { cancelled = true; loading?.destroy(); };
  }, [file]);

  return state;
}

export function describeLoadError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/password/i.test(msg)) return 'This PDF is password protected. Unlock it first, then try again.';
  if (/invalid pdf/i.test(msg)) return 'This file does not look like a valid PDF.';
  return msg;
}
