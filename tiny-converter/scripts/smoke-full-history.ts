// Teste de fumaça com o histórico completo (3462 linhas) do arquivo real da Lei Atual,
// só para garantir que a ferramenta não quebra em dados de produção de verdade.
import * as XLSX from "xlsx";
import fs from "node:fs";
import { convertOrders, type ClientRecord } from "../src/lib/orderConverter";
import type { CodeTableEntry, ColumnMapping, CellValue } from "../src/lib/types";
import { DEFAULT_SIZE_LETTERS } from "../src/lib/sizeRules";
import { ORDER_COL } from "../src/lib/tinyFormats";

const FIXTURE = process.env.PEDIDOS_PATH!;
const buf = fs.readFileSync(FIXTURE);
const wb = XLSX.read(buf, { cellDates: true });

function sheetAOA(name: string): CellValue[][] {
  const ws = wb.Sheets[name];
  return XLSX.utils.sheet_to_json<CellValue[]>(ws, { header: 1, raw: true, defval: null });
}

const hist = sheetAOA("Hist. Pedidos");
const histHeaders = hist[0] as string[];
const histRows = hist.slice(1);

const coresAoa = sheetAOA("Cores");
const colorTable: CodeTableEntry[] = coresAoa
  .slice(1)
  .filter((r) => r && r[0])
  .map((r, i) => ({ code: String(i + 1), name: String(r[0]) }));

const clientesAoa = sheetAOA("Clientes");
const clients: ClientRecord[] = clientesAoa
  .slice(1)
  .filter((r) => r && r[1])
  .map((r) => ({ razaoSocial: String(r[0] ?? ""), nomeFantasia: String(r[1] ?? ""), cnpjOuCpf: String(r[2] ?? ""), ie: String(r[3] ?? "") }));

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

console.log("Cores:", colorTable.length, "Clientes:", clients.length, "Linhas origem:", histRows.length);

const t0 = Date.now();
const result = convertOrders(histRows, mapping, colorTable, DEFAULT_SIZE_LETTERS, clients, {
  incluirCondicaoNasObservacoes: false,
});
console.log("Tempo:", Date.now() - t0, "ms");
console.log("Linhas geradas:", result.rows.length);
console.log("Warnings totais:", result.warnings.length);

const byMsgPrefix: Record<string, number> = {};
for (const w of result.warnings) {
  const key = w.message.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, "N");
  byMsgPrefix[key] = (byMsgPrefix[key] ?? 0) + 1;
}
console.log("\nResumo de avisos:");
for (const [k, v] of Object.entries(byMsgPrefix).sort((a, b) => b[1] - a[1])) {
  console.log(` ${v}x  ${k}`);
}

console.log("\nAmostra de 10 linhas convertidas:");
for (const r of result.rows.slice(0, 10)) {
  console.log(" ", r[ORDER_COL["Descrição"]], "|", r[ORDER_COL["Código (SKU)"]], "| qtd", r[ORDER_COL["Quantidade"]]);
}

const semClienteRate = result.stats.clientesNaoEncontrados / result.rows.length;
console.log(`\nTaxa de clientes não encontrados: ${(semClienteRate * 100).toFixed(1)}%`);

let withPedido = 0, withAll5 = 0, blank=0;
for (const row of histRows) {
  const np = row[mapping.numPedido!];
  const cl = row[mapping.cliente!];
  const cr = row[mapping.codRef!];
  const de = row[mapping.descricao!];
  const ta = row[mapping.tamanho!];
  if (np) withPedido++;
  if (np && cl && cr && de && ta) withAll5++;
  if (!np && !cl && !cr && !de) blank++;
}
console.log("\nDiagnóstico:");
console.log("linhas com Nº Pedido preenchido:", withPedido);
console.log("linhas com os 5 campos obrigatórios preenchidos:", withAll5);
console.log("linhas totalmente em branco (critério de pular silenciosamente):", blank);
console.log("primeiras 5 linhas cruas:", histRows.slice(0,5));
