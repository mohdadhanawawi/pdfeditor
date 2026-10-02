import { useRef, useState } from 'react';
import { Icon } from './Icon';

type Props = {
  accept: string;
  multiple?: boolean;
  label: string;
  onFiles: (files: File[]) => void;
  compact?: boolean;
};

export function Dropzone({ accept, multiple, label, onFiles, compact }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list?.length) return;
    onFiles(multiple ? Array.from(list) : [list[0]]);
  };

  const picker = (
    <input ref={input} type="file" hidden accept={accept} multiple={multiple}
      onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />
  );

  if (compact) {
    return (
      <button className="btn btn-ghost" onClick={() => input.current?.click()}>
        <Icon name="plus" size={18} /> {label}
        {picker}
      </button>
    );
  }

  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
    >
      <button className="btn btn-primary btn-xl" onClick={() => input.current?.click()}>
        <Icon name="upload" size={22} /> {label}
      </button>
      <p className="muted">or drop {multiple ? 'files' : 'a file'} here</p>
      {picker}
    </div>
  );
}
