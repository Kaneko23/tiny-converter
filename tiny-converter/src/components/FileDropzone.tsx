import { useCallback, useRef, useState } from "react";

interface Props {
  onFile: (file: File) => void;
  label?: string;
  fileName?: string | null;
}

export function FileDropzone({ onFile, label, fileName }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (files && files[0]) onFile(files[0]);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-sm border-2 border-dashed p-10 text-center transition-colors ${
        dragOver ? "border-brand-500 bg-brand-50" : "border-line bg-card hover:border-brand-300"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <svg
        viewBox="0 0 40 40"
        className="mx-auto h-9 w-9 text-brand-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 25V7M13.5 13.5 20 7l6.5 6.5" />
        <path d="M8 25v4a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3v-4" />
      </svg>
      <p className="mt-3 font-display text-base font-semibold text-ink">
        {fileName ? fileName : label ?? "Arraste a planilha aqui ou clique para escolher"}
      </p>
      <p className="mt-1 text-sm text-muted">.xlsx, .xlsm, .xls ou .csv</p>
    </div>
  );
}
