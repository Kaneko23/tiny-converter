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
      className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        dragOver ? "border-brand-500 bg-brand-50" : "border-gray-300 bg-white hover:border-brand-200"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="text-3xl">📄</div>
      <p className="mt-2 font-medium text-gray-700">
        {fileName ? fileName : label ?? "Arraste a planilha aqui ou clique para escolher"}
      </p>
      <p className="mt-1 text-sm text-gray-400">.xlsx, .xlsm, .xls ou .csv</p>
    </div>
  );
}
