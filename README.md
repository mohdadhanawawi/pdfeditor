# PDF Editor

An iLovePDF-style web app with every common PDF tool in one place. Everything runs **in the browser** using [pdf.js](https://mozilla.github.io/pdf.js/) (rendering) and [pdf-lib](https://pdf-lib.js.org/) (writing). Files are never uploaded, so there is no backend to run or pay for.

## Tools

| Tool | What it does |
| --- | --- |
| Merge PDF | Combine several PDFs; drag to reorder, sort by name |
| Split PDF | Custom ranges (`1-3, 4-6, 7-`), fixed chunk size, or every page → ZIP |
| Organize PDF | Drag-reorder, rotate and delete pages in one view |
| Remove / Extract pages | Click or type page ranges (shift-click selects a range) |
| Compress PDF | Lossless clean-up, or re-render pages as JPEG at 150/96 DPI |
| Rotate PDF | Rotate all pages or individual ones |
| JPG to PDF | JPG/PNG/WebP/GIF → PDF, A4/Letter/fit, orientation, margins, EXIF-aware |
| PDF to JPG | Each page → JPG or PNG at 96/150/300 DPI |
| Add watermark | Text, font, colour, opacity, angle, 9 positions or mosaic, page range |
| Page numbers | 6 positions, 4 formats, page range, start number, book-style mirroring |
| Edit PDF | Text, freehand drawing, shapes, highlight, whiteout, images; move/resize, undo |
| Sign PDF | Draw, type or upload a signature and place it on any page |

Text the standard PDF fonts can't encode (e.g. Chinese, Arabic, emoji) is stamped as an image so it still works. Pages with a `/Rotate` entry or a crop box are handled correctly by all stamping tools.

## Install as an app (PWA)

The site is a Progressive Web App. Once opened it is cached by a service worker, so every tool keeps working **offline**.

- **Android / Chrome / Edge:** tap **Install app** in the header (or the browser's install prompt).
- **iPhone / iPad:** Safari → Share → **Add to Home Screen** (the Install app button shows these steps).

When a new version is deployed, the app shows a "new version available" toast; tapping **Reload** switches to it. The service worker is generated at build time (`src/sw-template.js` + the `pdfeditor-sw` plugin in `vite.config.ts`) with a precache list of every built file.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

The build uses relative asset paths, so `dist/` can be dropped on any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages, S3…).

### GitHub Pages

`.github/workflows/deploy.yml` builds and deploys on every push to `main`. Enable it once under **Settings → Pages → Source: GitHub Actions**.

## Project layout

```
src/
  App.tsx              hash router + home page
  tools/               one component per tool (+ registry.ts with tool metadata)
  components/          ToolShell (upload → options → result flow), page grid, thumbnails, signature pad
  lib/                 pdf.js setup, page-range parsing, stamping/rotation maths, annotation export
```

## Limitations

- Password-protected PDFs can't be opened (pdf-lib has no decryption support).
- "Recommended" / "Extreme" compression rasterises pages, so text is no longer selectable.
- Editing adds content on top of the page; it can't change existing text in place (use Whiteout + Text).
