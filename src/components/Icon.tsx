const paths: Record<string, string> = {
  merge: 'M4 4h7v7H4zM13 13h7v7h-7zM11 7.5h4.5V11M15.5 7.5 9 14M4 16.5h4M6 14.5v4',
  split: 'M4 4h16v16H4zM12 4v16M8 12H5m14 0h-3M7.5 9.5 5 12l2.5 2.5M16.5 9.5 19 12l-2.5 2.5',
  compress: 'M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5M3 3l5 5M21 3l-5 5M3 21l5-5M21 21l-5-5',
  organize: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  rotate: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  remove: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  extract: 'M6 3h9l4 4v14H6zM15 3v4h4M12 10v7M9 14l3 3 3-3',
  jpg2pdf: 'M4 5h11v10H4zM6.5 12.5l2.5-3 2 2.5 1.5-1.5 1.5 2M15 13h5v8H9v-6M12 17h5',
  pdf2jpg: 'M4 3h9l4 4v6H4zM13 3v4h4M9 14h11v7H9zM11 19.5l2.5-3 2 2 1.5-1.5 2 2.5',
  watermark: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11zM9.5 15a2.5 2.5 0 0 0 2.5 2.5',
  numbers: 'M6 3h12v18H6zM10 17h4M11 7l2-1v6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4M14 20h6',
  sign: 'M3 17c3-6 5-9 6.5-9 2 0-2 9 .5 9 1.5 0 3-4 4.5-4 1 0 .5 3 2 3 1 0 2-1 3-2M3 21h18',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  close: 'M6 6l12 12M18 6 6 18',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  rect: 'M4 6h16v12H4z',
  image: 'M4 5h16v14H4zM8.5 10.5a1.5 1.5 0 1 0 0-.01M20 15l-5-5-9 9',
  pen: 'M4 20c4-1 6-5 8-8s4-6 8-8',
  pointer: 'M5 3l14 8-6 2-2 7z',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  device: 'M4 5h16v11H4zM9 20h6M12 16v4',
};

export function Icon({ name, size = 24, stroke = 2 }: { name: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] ?? paths.organize} />
    </svg>
  );
}
