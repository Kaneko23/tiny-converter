import * as XLSX from "xlsx";
import type { CellValue, SheetData, WorkbookData } from "./types";

/**
 * Lê um arquivo .xlsx/.xlsm/.xls/.csv enviado pelo usuário e devolve todas as
 * abas como matrizes de valores crus (sem interpretar nada ainda).
 */
export async function readWorkbookFile(file: File): Promise<WorkbookData> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true, WTF: false });

  const sheets: SheetData[] = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    // blankrows precisa ficar em true (padrão): se linhas em branco fossem
    // removidas aqui, o número da "linha de cabeçalho" que o usuário digita na
    // tela (contando como no Excel) deixaria de bater com o índice real usado
    // por sliceSheetFromHeaderRow, e o mapeamento de colunas pegaria a linha
    // errada (bug observado: linha de dados sendo tratada como cabeçalho).
    const aoa = XLSX.utils.sheet_to_json<CellValue[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
    });

    if (aoa.length === 0) {
      return { sheetName, headers: [], rows: [] };
    }

    const headers = (aoa[0] || []).map((h, i) =>
      h === null || h === undefined || String(h).trim() === ""
        ? `Coluna ${i + 1}`
        : String(h).trim()
    );
    const rows = aoa.slice(1);
    return { sheetName, headers, rows };
  });

  return { fileName: file.name, sheets };
}

/** Gera um Blob .xlsx a partir de cabeçalhos + linhas, pronto para download. */
export function buildXlsxBlob(
  headers: string[],
  rows: CellValue[][],
  sheetName = "Planilha1"
): Blob {
  const wb = XLSX.utils.book_new();
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Gera um workbook com múltiplas abas (ex: dados + "Leia-me"). */
export function buildMultiSheetXlsxBlob(
  sheets: { name: string; headers: string[]; rows: CellValue[][] }[]
): Blob {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.headers, ...s.rows]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Reconstrói headers/rows de uma aba usando a linha `headerRowNumber` (1-based,
 * contando a partir da primeira linha da aba) como cabeçalho. Útil para planilhas
 * como o Mostruário, que têm título e linhas em branco antes da tabela de verdade.
 */
export function sliceSheetFromHeaderRow(sheet: SheetData, headerRowNumber: number): SheetData {
  // sheet.rows já é "tudo menos a primeira linha" (headers originais viraram sheet.headers).
  const allRows = [sheet.headers as CellValue[], ...sheet.rows];
  const idx = Math.max(1, headerRowNumber) - 1;
  const headerRowRaw = allRows[idx] ?? [];
  const headers = headerRowRaw.map((h, i) =>
    h === null || h === undefined || String(h).trim() === "" ? `Coluna ${i + 1}` : String(h).trim()
  );
  const rows = allRows.slice(idx + 1);
  return { sheetName: sheet.sheetName, headers, rows };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
