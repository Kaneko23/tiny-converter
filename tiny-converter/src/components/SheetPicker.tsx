import type { SheetData } from "../lib/types";

interface Props {
  sheets: SheetData[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  headerRow: number;
  onHeaderRowChange: (n: number) => void;
}

export function SheetPicker({ sheets, selectedIndex, onSelect, headerRow, onHeaderRowChange }: Props) {
  if (sheets.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-3">
      <label className="text-sm">
        <div className="mb-1 text-gray-500">Aba da planilha</div>
        <select
          className="rounded-md border border-gray-300 px-2 py-1"
          value={selectedIndex}
          onChange={(e) => onSelect(Number(e.target.value))}
        >
          {sheets.map((s, i) => (
            <option key={i} value={i}>
              {s.sheetName} ({s.rows.length} linhas)
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <div className="mb-1 text-gray-500">Linha do cabeçalho</div>
        <input
          type="number"
          min={1}
          className="w-24 rounded-md border border-gray-300 px-2 py-1"
          value={headerRow}
          onChange={(e) => onHeaderRowChange(Math.max(1, Number(e.target.value) || 1))}
        />
      </label>
      <p className="max-w-sm text-xs text-gray-400">
        Se sua planilha tiver títulos ou linhas em branco antes da tabela de verdade (como o
        Mostruário), ajuste aqui para a linha onde estão os nomes das colunas.
      </p>
    </div>
  );
}
