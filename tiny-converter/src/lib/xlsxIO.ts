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

/** Tamanho máximo aceito pelo Tiny num único arquivo de importação. */
export const MAX_TINY_IMPORT_BYTES = 1.9 * 1024 * 1024; // 1,9 MB — um pouco abaixo do limite de 2 MB do Tiny, de margem.

/**
 * Agrupa as linhas mantendo juntas as que pertencem ao mesmo "grupo" (ex: produto
 * pai + suas variações, ou todos os itens de um mesmo pedido) — pra nunca separar
 * um grupo em arquivos diferentes ao dividir por causa do limite de tamanho do Tiny.
 */
export function groupRows(rows: CellValue[][], groupKeyFn: (row: CellValue[]) => string): CellValue[][][] {
  const order: string[] = [];
  const map = new Map<string, CellValue[][]>();
  for (const row of rows) {
    const key = groupKeyFn(row);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(row);
  }
  return order.map((k) => map.get(k)!);
}

/**
 * Divide os grupos de linhas em uma ou mais planilhas .xlsx, cada uma abaixo do
 * limite de tamanho do Tiny — sem nunca quebrar um grupo (produto pai+variações,
 * ou pedido) ao meio entre dois arquivos.
 */
export function buildXlsxPartsUnderLimit(
  headers: string[],
  groups: CellValue[][][],
  sheetName: string,
  maxBytes: number = MAX_TINY_IMPORT_BYTES
): Blob[] {
  const allRows = groups.flat();
  if (allRows.length === 0) return [buildXlsxBlob(headers, [], sheetName)];

  const fullBlob = buildXlsxBlob(headers, allRows, sheetName);
  if (fullBlob.size <= maxBytes || groups.length <= 1) return [fullBlob];

  // estimativa grosseira de bytes/linha a partir do arquivo inteiro, com margem de segurança
  const approxBytesPerRow = fullBlob.size / allRows.length;
  const targetRowsPerPart = Math.max(1, Math.floor((maxBytes * 0.85) / approxBytesPerRow));

  const parts: CellValue[][][] = [];
  let current: CellValue[][] = [];
  for (const g of groups) {
    if (current.length > 0 && current.length + g.length > targetRowsPerPart) {
      parts.push(current);
      current = [];
    }
    current.push(...g);
  }
  if (current.length) parts.push(current);

  // confere de verdade cada parte — se alguma ainda estourar (estimativa errada), quebra em duas e confere de novo
  const blobs: Blob[] = [];
  const stack = [...parts].reverse();
  while (stack.length) {
    const part = stack.pop()!;
    const blob = buildXlsxBlob(headers, part, sheetName);
    if (blob.size <= maxBytes || part.length <= 1) {
      blobs.push(blob);
    } else {
      const mid = Math.floor(part.length / 2) || 1;
      stack.push(part.slice(mid));
      stack.push(part.slice(0, mid));
    }
  }
  return blobs;
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
