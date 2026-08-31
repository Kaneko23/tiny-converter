import { useMemo } from "react";
import type { CellValue, ConversionResult } from "../lib/types";
import { groupRows, buildXlsxPartsUnderLimit, downloadBlob } from "../lib/xlsxIO";

interface Props {
  result: ConversionResult;
  fileLabel: string;
  sheetName: string;
  fileBaseName: string;
  /** Chave que identifica um "grupo" (produto pai+variações, ou pedido) que nunca pode ser
   * separado entre dois arquivos ao dividir por causa do limite de tamanho do Tiny (2 MB). */
  groupKeyFn: (row: CellValue[]) => string;
}

function formatCell(v: CellValue): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return v.toLocaleDateString("pt-BR");
  return String(v);
}

export function ResultsPanel({ result, fileLabel, sheetName, fileBaseName, groupKeyFn }: Props) {
  const previewRows = result.rows.slice(0, 15);
  const previewCols = result.headers
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => result.rows.some((r) => r[i] !== "" && r[i] !== null && r[i] !== undefined))
    .slice(0, 10);

  const parts = useMemo(() => {
    if (result.rows.length === 0) return [];
    const groups = groupRows(result.rows, groupKeyFn);
    return buildXlsxPartsUnderLimit(result.headers, groups, sheetName);
  }, [result, groupKeyFn, sheetName]);

  function handleDownloadPart(index: number) {
    const blob = parts[index];
    const filename =
      parts.length > 1 ? `${fileBaseName}-parte${index + 1}-de-${parts.length}.xlsx` : `${fileBaseName}.xlsx`;
    downloadBlob(blob, filename);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {Object.entries(result.stats).map(([k, v]) => (
          <div key={k} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
            <strong>{v}</strong> {k}
          </div>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {parts.length > 1 && (
            <span className="text-xs text-amber-600">
              o Tiny só aceita até ~2 MB por arquivo — dividido em {parts.length} partes
            </span>
          )}
          {parts.map((_, i) => (
            <button
              key={i}
              onClick={() => handleDownloadPart(i)}
              disabled={result.rows.length === 0}
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
            >
              {parts.length > 1 ? `Baixar parte ${i + 1} de ${parts.length}` : `Baixar ${fileLabel} (.xlsx)`}
            </button>
          ))}
          {parts.length === 0 && (
            <button
              disabled
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white opacity-40"
            >
              Baixar {fileLabel} (.xlsx)
            </button>
          )}
        </div>
      </div>

      {result.warnings.length > 0 && (
        <details className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <summary className="cursor-pointer font-medium">
            {result.warnings.length} aviso(s) — clique para ver
          </summary>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {result.warnings.map((w, i) => (
              <li key={i}>
                <span className="text-amber-500">linha {w.rowIndex}:</span> {w.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                {previewCols.map(({ h, i }) => (
                  <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r, ri) => (
                <tr key={ri} className="border-t border-gray-100">
                  {previewCols.map(({ i }) => (
                    <td key={i} className="whitespace-nowrap px-3 py-1.5 text-gray-700">
                      {formatCell(r[i])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {result.rows.length > previewRows.length && (
            <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-400">
              mostrando {previewRows.length} de {result.rows.length} linhas
            </p>
          )}
        </div>
      )}
    </div>
  );
}
