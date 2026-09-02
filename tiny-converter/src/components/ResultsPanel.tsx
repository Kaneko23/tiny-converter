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
          <div
            key={k}
            className="rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-sm text-brand-700"
          >
            <strong>{v}</strong> {k}
          </div>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {parts.length > 1 && (
            <span className="text-xs text-warn-text">
              o Tiny só aceita até ~2 MB por arquivo — dividido em {parts.length} partes
            </span>
          )}
          {parts.map((_, i) => (
            <button
              key={i}
              onClick={() => handleDownloadPart(i)}
              disabled={result.rows.length === 0}
              className="rounded-full bg-brand-600 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-paper hover:bg-brand-700 disabled:opacity-40"
            >
              {parts.length > 1 ? `Baixar parte ${i + 1} de ${parts.length}` : `Baixar ${fileLabel}`}
            </button>
          ))}
          {parts.length === 0 && (
            <button
              disabled
              className="rounded-full bg-brand-600 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-paper opacity-40"
            >
              Baixar {fileLabel}
            </button>
          )}
        </div>
      </div>

      {result.warnings.length > 0 && (
        <details className="rounded-sm border border-warn-border bg-warn-bg p-3 text-sm text-warn-text">
          <summary className="cursor-pointer font-semibold">
            {result.warnings.length} aviso(s) — clique para ver
          </summary>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {result.warnings.map((w, i) => (
              <li key={i}>
                <span className="font-semibold">linha {w.rowIndex}:</span> {w.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.rows.length > 0 && (
        <div className="overflow-x-auto rounded-sm border border-line bg-card">
          <table className="w-full text-xs">
            <thead className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
              <tr>
                {previewCols.map(({ h, i }) => (
                  <th key={i} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r, ri) => (
                <tr key={ri} className="border-t border-line/70">
                  {previewCols.map(({ i }) => (
                    <td key={i} className="whitespace-nowrap px-3 py-1.5 text-ink">
                      {formatCell(r[i])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {result.rows.length > previewRows.length && (
            <p className="border-t border-line/70 px-3 py-2 text-xs text-muted">
              mostrando {previewRows.length} de {result.rows.length} linhas
            </p>
          )}
        </div>
      )}
    </div>
  );
}
