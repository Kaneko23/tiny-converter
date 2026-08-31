// Valida o orderConverter contra o par real Hist. Pedidos -> Tiny do arquivo
// "Conversor Tiny Lei Atual.xlsm" (dado de referência fornecido pelo cliente).
import * as XLSX from "xlsx";
import fs from "node:fs";
import { convertOrders, type ClientRecord } from "../src/lib/orderConverter";
import type { CodeTableEntry, SizeLetterEntry, ColumnMapping, CellValue } from "../src/lib/types";
import { DEFAULT_SIZE_LETTERS } from "../src/lib/sizeRules";
import { ORDER_COL } from "../src/lib/tinyFormats";

const FIXTURE = process.env.CONVERSOR_PATH!;
const buf = fs.readFileSync(FIXTURE);
const wb = XLSX.read(buf, { cellDates: true });

function sheetAOA(name: string): CellValue[][] {
  const ws = wb.Sheets[name];
  return XLSX.utils.sheet_to_json<CellValue[]>(ws, { header: 1, raw: true, defval: null });
}

const hist = sheetAOA("Hist. Pedidos");
const histHeaders = hist[0] as string[];
const histRows = hist.slice(1);

const tiny = sheetAOA("Tiny");
const tinyRows = tiny.slice(1);

const clientesAoa = sheetAOA("Clientes");
const clientRows = clientesAoa.slice(1);
const clients: ClientRecord[] = clientRows
  .filter((r) => r && r[1])
  .map((r) => ({
    razaoSocial: String(r[0] ?? ""),
    nomeFantasia: String(r[1] ?? ""),
    cnpjOuCpf: String(r[2] ?? ""),
    ie: String(r[3] ?? ""),
  }));

const corAoa = sheetAOA("Cor");
const colorTable: CodeTableEntry[] = corAoa
  .slice(1)
  .filter((r) => r && r[0] !== null && r[0] !== undefined)
  .map((r) => ({ code: String(r[0]), name: String(r[1]) }));

console.log("Headers Hist. Pedidos:", histHeaders);
console.log("Clientes carregados:", clients.length);
console.log("Cores carregadas:", colorTable);

const mapping: ColumnMapping = {
  numPedido: histHeaders.indexOf("Nº Pedido"),
  cliente: histHeaders.indexOf("Cliente"),
  dataEmissao: histHeaders.indexOf("Data Emissão"),
  dataEntrega: histHeaders.indexOf("Data Entrega"),
  representante: histHeaders.indexOf("Representante"),
  codRef: histHeaders.indexOf("Cod Ref."),
  descricao: histHeaders.indexOf("Descrição"),
  cor: histHeaders.indexOf("Cor"),
  tamanho: histHeaders.indexOf("Tamanho"),
  quantidade: histHeaders.indexOf("Quant."),
  valorUnit: histHeaders.indexOf("Valor Unit."),
  condPagamento: histHeaders.indexOf("Cond. Pagamento"),
  formaPagamento: histHeaders.indexOf("Forma de Pagamento"),
  observacoes: histHeaders.indexOf("Observações"),
};

const sizeLetters: SizeLetterEntry[] = DEFAULT_SIZE_LETTERS;

const result = convertOrders(histRows, mapping, colorTable, sizeLetters, clients, {
  incluirCondicaoNasObservacoes: false,
});

console.log("\nLinhas geradas:", result.rows.length, "de", histRows.length, "linhas de origem");
console.log("Warnings:", result.warnings.length);
for (const w of result.warnings) console.log("  -", w.rowIndex, w.message);

// Comparação por multiset (a ordem das linhas não importa para uma importação em lote) —
// normalizamos espaços duplos na descrição (defeito de digitação da fonte original) para
// não acusar falso-positivo.
function normDesc(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}
function keyOf(r: CellValue[]): string {
  return [
    normDesc(r[ORDER_COL["Descrição"]]),
    String(r[ORDER_COL["Código (SKU)"]]),
    r[ORDER_COL["Quantidade"]],
    r[ORDER_COL["Valor unitário"]],
  ].join("||");
}

const gotKeys = new Map<string, number>();
for (const r of result.rows) gotKeys.set(keyOf(r), (gotKeys.get(keyOf(r)) ?? 0) + 1);
const wantKeys = new Map<string, number>();
for (const r of tinyRows) wantKeys.set(keyOf(r), (wantKeys.get(keyOf(r)) ?? 0) + 1);

let mismatches = 0;
for (const [k, count] of wantKeys) {
  const gotCount = gotKeys.get(k) ?? 0;
  if (gotCount !== count) {
    mismatches++;
    console.log(`FALTANDO/DIVERGENTE (esperado x${count}, obtido x${gotCount}):`, k);
  }
}
for (const [k, count] of gotKeys) {
  if (!wantKeys.has(k)) {
    mismatches++;
    console.log(`SOBRANDO (não esperado, x${count}):`, k);
  }
}

// Checagem extra: dados do cliente (Tipo de Pessoa / CPF-CNPJ / RG-IE) batendo com o exemplo.
const sampleWant = tinyRows[0];
const sampleGot = result.rows.find(
  (r) => String(r[ORDER_COL["Número do pedido"]]) === String(sampleWant[ORDER_COL["Número do pedido"]])
);
console.log("\nConferência de dados de cliente (pedido", sampleWant[ORDER_COL["Número do pedido"]], "):");
console.log("  esperado:", {
  tipo: sampleWant[ORDER_COL["Tipo de Pessoa"]],
  cnpj: sampleWant[ORDER_COL["CPF/CNPJ"]],
  ie: sampleWant[ORDER_COL["RG/IE"]],
});
console.log("  obtido:  ", {
  tipo: sampleGot?.[ORDER_COL["Tipo de Pessoa"]],
  cnpj: sampleGot?.[ORDER_COL["CPF/CNPJ"]],
  ie: sampleGot?.[ORDER_COL["RG/IE"]],
});

console.log(
  `\n${mismatches === 0 ? "OK ✅ todas as linhas batem (comparação por conjunto, ordem ignorada)" : "FALHOU ❌"} — ${mismatches} divergências.`
);
if (result.rows.length !== tinyRows.length) {
  console.log(
    `ATENÇÃO: número de linhas diferente (gerado=${result.rows.length}, esperado=${tinyRows.length}).`
  );
}
process.exit(mismatches === 0 ? 0 : 1);
