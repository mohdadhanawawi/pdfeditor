import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { Icon } from './components/Icon';
import { TOOLS, toolById } from './tools/registry';
import { usePwa } from './pwa';

const pages: Record<string, ComponentType> = {
  merge: lazy(() => import('./tools/Merge')),
  split: lazy(() => import('./tools/Split')),
  organize: lazy(() => import('./tools/Organize')),
  remove: lazy(() => import('./tools/SelectPages').then((m) => ({ default: m.RemovePages }))),
  extract: lazy(() => import('./tools/SelectPages').then((m) => ({ default: m.ExtractPages }))),
  compress: lazy(() => import('./tools/Compress')),
  rotate: lazy(() => import('./tools/Rotate')),
  'jpg-to-pdf': lazy(() => import('./tools/ImagesToPdf')),
  'pdf-to-jpg': lazy(() => import('./tools/PdfToImages')),
  watermark: lazy(() => import('./tools/Watermark')),
  'page-numbers': lazy(() => import('./tools/PageNumbers')),
  edit: lazy(() => import('./tools/Editor').then((m) => ({ default: m.EditPdf }))),
  sign: lazy(() => import('./tools/Editor').then((m) => ({ default: m.SignPdf }))),
};

function useRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

const CATEGORIES = ['All', 'Organize', 'Optimize', 'Convert', 'Edit'] as const;

function Home() {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('All');
  const list = TOOLS.filter((t) => cat === 'All' || t.category === cat);
  return (
    <>
      <section className="hero">
        <h1>Every tool you need to work with PDFs in one place</h1>
        <p className="lead">Merge, split, compress, convert, rotate, watermark, sign and edit PDFs — free, fast, and 100% in your browser.</p>
        <div className="chips">
          {CATEGORIES.map((c) => <button key={c} className={`chip${cat === c ? ' active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      </section>
      <section className="tool-grid">
        {list.map((t) => (
          <a key={t.id} href={`#/${t.id}`} className="tool-card">
            <div className="tool-icon" style={{ background: t.color }}><Icon name={t.icon} size={26} /></div>
            <h3>{t.title}</h3>
            <p>{t.description}</p>
          </a>
        ))}
      </section>
      <section className="features">
        <div><Icon name="shield" size={28} /><h4>Private by design</h4><p>Your files never leave your device. Everything runs locally with pdf.js and pdf-lib.</p></div>
        <div><Icon name="bolt" size={28} /><h4>Fast</h4><p>No upload or download queues — results are ready the moment processing finishes.</p></div>
        <div><Icon name="device" size={28} /><h4>Works everywhere</h4><p>Any modern browser on desktop, tablet or phone. No sign-up, no watermark on your output.</p></div>
      </section>
    </>
  );
}

function InstallButton() {
  const pwa = usePwa();
  const [iosOpen, setIosOpen] = useState(false);
  if (pwa.canInstall) {
    return <button className="btn btn-primary btn-install" onClick={pwa.install}><Icon name="download" size={16} /> Install app</button>;
  }
  if (!pwa.showIosHint) return null;
  return (
    <>
      <button className="btn btn-primary btn-install" onClick={() => setIosOpen(true)}><Icon name="download" size={16} /> Install app</button>
      {iosOpen && (
        <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setIosOpen(false)}>
          <div className="modal">
            <div className="modal-head">
              <h3>Install on iPhone / iPad</h3>
              <button className="icon-btn" onClick={() => setIosOpen(false)}><Icon name="close" size={18} /></button>
            </div>
            <ol className="ios-steps">
              <li>Tap the <strong>Share</strong> button <span className="ios-share" aria-hidden>⬆︎</span> in Safari's toolbar.</li>
              <li>Scroll down and choose <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong>. PDF Editor opens full-screen and works offline.</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}

function UpdateToast() {
  const pwa = usePwa();
  if (!pwa.updateReady) return null;
  return (
    <div className="toast update" role="status">
      A new version is available.
      <button className="btn btn-primary" onClick={pwa.applyUpdate}>Reload</button>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const Page = pages[route];
  const meta = toolById(route);

  useEffect(() => {
    document.title = meta ? `${meta.title} – PDF Editor` : 'PDF Editor – Every PDF tool in one place';
  }, [meta]);

  const fullscreen = !!Page && (route === 'edit' || route === 'sign');

  return (
    <div className={fullscreen ? 'app app-fixed' : 'app'}>
      <header className="topbar">
        <a href="#/" className="logo"><span className="logo-mark">PDF</span> Editor</a>
        <nav className="topnav">
          {['merge', 'split', 'compress', 'edit', 'sign'].map((id) => (
            <a key={id} href={`#/${id}`} className={route === id ? 'active' : ''}>{toolById(id)!.title.replace(' PDF', '')}</a>
          ))}
          <a href="#/" className={!Page ? 'active' : ''}>All tools</a>
        </nav>
        <InstallButton />
      </header>
      <main className={fullscreen ? 'main main-wide' : 'main'}>
        <Suspense fallback={<div className="center-box"><div className="spinner" /></div>}>
          {Page ? <Page key={route} /> : <Home />}
        </Suspense>
      </main>
      <UpdateToast />
      {!fullscreen && <footer className="footer">
        <span>© {new Date().getFullYear()} PDF Editor · Files are processed locally and never uploaded.</span>
      </footer>}
    </div>
  );
}
