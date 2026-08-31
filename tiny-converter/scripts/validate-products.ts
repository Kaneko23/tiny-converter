import * as XLSX from "xlsx";
import fs from "node:fs";
import { convertProducts, DEFAULT_PRODUCT_DEFAULTS } from "../src/lib/productConverter";
import type { CodeTableEntry, ColumnMapping, CellValue } from "../src/lib/types";
import { DEFAULT_SIZE_LETTERS } from "../src/lib/sizeRules";
import { PRODUCT_COL } from "../src/lib/tinyFormats";

const FIXTURE = process.env.MOSTRUARIO_PATH!;
const buf = fs.readFileSync(FIXTURE);
const wb = XLSX.read(buf, { cellDates: true });
const ws = wb.Sheets["REFERENCIAS"];
const aoa = XLSX.utils.sheet_to_json<CellValue[]>(ws, { header: 1, raw: true, defval: null });

// A aba REFERENCIAS não tem um cabeçalho único no topo (tem seções soltas), então
// simulamos a "planilha de origem" pegando linhas cruas e mapeando por posição de coluna,
// igual o usuário faria na etapa de mapeamento de colunas da ferramenta.
const rows = aoa.slice(0); // sem remover header, o parser filtra sozinho por conteúdo
const mapping: ColumnMapping = {
  descricao: 0,
  refFinal: 1,
  refBase: 2,
  tecido: 3,
  codMolde: 4,
  cores: 5,
  grade: 6,
  notaExtra: 7,
};

const colorTable: CodeTableEntry[] = [
  { code: "1", name: "BRANCA" },
  { code: "2", name: "PRETA" },
  { code: "3", name: "CREME" },
  { code: "4", name: "VERDE" },
  { code: "5", name: "MARRON" },
  { code: "6", name: "LINHO" },
];

const result = convertProducts(
  rows,
  mapping,
  colorTable,
  DEFAULT_SIZE_LETTERS,
  DEFAULT_PRODUCT_DEFAULTS,
  2
);

console.log("Total linhas geradas:", result.rows.length);
console.log("Stats:", result.stats);
console.log("Warnings (primeiros 10):", result.warnings.slice(0, 10));

// Checagem pontual: produto 7020 (Wide Leg Alicia, cores 2,3,4,5, grade P a G2)
const rowsFor7020 = result.rows.filter(
  (r) => String(r[PRODUCT_COL["Código do pai"]]) === "7020" || String(r[PRODUCT_COL["Código (SKU)"]]) === "7020"
);
console.log("\nLinhas para ref 7020:", rowsFor7020.length, "(esperado: 1 pai + 4 cores x 6 tamanhos = 25)");
for (const r of rowsFor7020.slice(0, 4)) {
  console.log(" ", r[PRODUCT_COL["Código (SKU)"]], r[PRODUCT_COL["Descrição"]], "|", r[PRODUCT_COL["Variações"]]);
}

const expected = 1 + 4 * 6;
process.exit(rowsFor7020.length === expected ? 0 : 1);
