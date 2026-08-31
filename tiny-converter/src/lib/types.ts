// Tipos compartilhados entre os conversores de Produtos e de Pedidos.

export type CellValue = string | number | Date | null | undefined;

/** Planilha genérica lida do upload: cabeçalhos + linhas cruas. */
export interface SheetData {
  sheetName: string;
  headers: string[];
  rows: CellValue[][];
}

/** Um arquivo Excel pode ter várias abas — guardamos todas para o usuário escolher. */
export interface WorkbookData {
  fileName: string;
  sheets: SheetData[];
}

/** Par código -> nome usado tanto para cores quanto para qualquer outra legenda numerada. */
export interface CodeTableEntry {
  code: string; // sempre normalizado para string, sem zero à esquerda obrigatório na digitação
  name: string;
}

/** Tabela de tamanhos em letra, na ORDEM em que devem ser expandidos (P < M < G < GG < G1 < G2 ...). */
export interface SizeLetterEntry {
  label: string; // "P", "M", "G", "GG", "G1", "G2", ...
  code: string; // "01".."06", sempre 2 dígitos
}

export interface ColumnMapping {
  [targetField: string]: number | null; // índice da coluna de origem (0-based), ou null se não mapeada
}

export interface FieldSpec {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

export interface ConversionWarning {
  rowIndex: number; // índice da linha de origem (1-based, considerando cabeçalho como linha 1)
  message: string;
}

export interface ConversionResult {
  headers: string[];
  rows: CellValue[][];
  warnings: ConversionWarning[];
  stats: Record<string, number>;
}
