export type ToolMeta = {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: 'Organize' | 'Optimize' | 'Convert' | 'Edit';
};

export const TOOLS: ToolMeta[] = [
  { id: 'merge', title: 'Merge PDF', description: 'Combine multiple PDFs into one document in the order you want.', icon: 'merge', color: '#e5322d', category: 'Organize' },
  { id: 'split', title: 'Split PDF', description: 'Separate one PDF into several files by page ranges or every page.', icon: 'split', color: '#e5322d', category: 'Organize' },
  { id: 'organize', title: 'Organize PDF', description: 'Drag to reorder, rotate or delete pages — all in one view.', icon: 'organize', color: '#f08c00', category: 'Organize' },
  { id: 'remove', title: 'Remove pages', description: 'Pick the pages you do not need and drop them from the PDF.', icon: 'remove', color: '#f08c00', category: 'Organize' },
  { id: 'extract', title: 'Extract pages', description: 'Pull out only the pages you need into a new PDF.', icon: 'extract', color: '#f08c00', category: 'Organize' },
  { id: 'compress', title: 'Compress PDF', description: 'Shrink file size while keeping the best quality possible.', icon: 'compress', color: '#2f9e44', category: 'Optimize' },
  { id: 'rotate', title: 'Rotate PDF', description: 'Rotate every page or just the ones you pick.', icon: 'rotate', color: '#7048e8', category: 'Edit' },
  { id: 'jpg-to-pdf', title: 'JPG to PDF', description: 'Turn JPG, PNG or WebP images into a PDF with custom page size.', icon: 'jpg2pdf', color: '#f59f00', category: 'Convert' },
  { id: 'pdf-to-jpg', title: 'PDF to JPG', description: 'Convert every PDF page into a high quality JPG or PNG image.', icon: 'pdf2jpg', color: '#f59f00', category: 'Convert' },
  { id: 'watermark', title: 'Add watermark', description: 'Stamp text over your PDF with custom size, colour and opacity.', icon: 'watermark', color: '#1c7ed6', category: 'Edit' },
  { id: 'page-numbers', title: 'Page numbers', description: 'Add page numbers with your choice of position and format.', icon: 'numbers', color: '#1c7ed6', category: 'Edit' },
  { id: 'edit', title: 'Edit PDF', description: 'Add text, shapes, images, highlights and freehand drawings.', icon: 'edit', color: '#c2255c', category: 'Edit' },
  { id: 'sign', title: 'Sign PDF', description: 'Draw your signature and place it anywhere on the document.', icon: 'sign', color: '#c2255c', category: 'Edit' },
];

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);
