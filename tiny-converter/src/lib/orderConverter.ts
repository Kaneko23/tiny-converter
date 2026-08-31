import type {
  CellValue,
  ColumnMapping,
  ConversionResult,
  ConversionWarning,
  CodeTableEntry,
  SizeLetterEntry,
} from "./types";
import { TINY_ORDER_HEADERS, ORDER_COL, emptyOrderRow } from "./tinyFormats";
import { sizeToCode } from "./sizeRules";
import { lookupColorName } from "./colorRules";

export const ORDER_FIELDS = [
  { key: "numPedido", label: "Nº do Pedido", required: true },
  { key: "cliente", label: "Cliente (nome fantasia)", required: true },
  { key: "dataEmissao", label: "Data de Emissão", required: true },
  { key: "dataEntrega", label: "Data de Entrega prevista", required: false },
  { key: "representante", label: "Representante / Vendedor", required: false },
  { key: "codRef", label: "Cód. Referência (aceita \"1234/5\")", required: true },
  { key: "descricao", label: "Descrição do produto", required: true },
  { key: "cor", label: "Cor (código numérico, opcional)", required: false },
  { key: "tamanho", label: "Tamanho", required: true },
  { key: "quantidade", label: "Quantidade", required: true },
  { key: "valorUnit", label: "Valor Unitário", required: true },
  { key: "condPagamento", label: "Condição de Pagamento (opcional)", required: false },
  { key: "formaPagamento", label: "Forma de Pagamento (opcional)", required: false },
  { key: "observacoes", label: "Observações do pedido (opcional)", required: false },
] as const;

export interface ClientRecord {
  nomeFantasia: string;
  razaoSocial?: string;
  cnpjOuCpf?: string;
  ie?: string;
}

export interface OrderConverterOptions {
  incluirCondicaoNasObservacoes: boolean;
  anoPadraoEntrega?: number; // usado só quando "Data Entrega" vier sem ano (ex: "15/04")
}

export const DEFAULT_ORDER_OPTIONS: OrderConverterOptions = {
  incluirCondicaoNasObservacoes: false,
};

function cellToString(v: CellValue): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function getCell(row: CellValue[], mapping: ColumnMapping, field: string): CellValue {
  const idx = mapping[field];
  if (idx === null || idx === undefined) return null;
  return row[idx] ?? null;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function findClient(nome: string, clients: ClientRecord[]): ClientRecord | null {
  const key = nome.trim().toLowerCase();
  if (!key) return null;
  return (
    clients.find((c) => c.nomeFantasia.trim().toLowerCase() === key) ?? null
  );
}

/** Converte um valor de data (Date, número serial do Excel ou texto) em objeto Date. */
function toDate(v: CellValue): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    // número serial do Excel (dias desde 1899-12-30)
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + v * 86400000);
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

/** "Data Entrega" pode vir só como "dd/mm" (sem ano) em algumas planilhas antigas. */
function parseDataEntrega(
  v: CellValue,
  anoPadrao: number | undefined,
  anoEmissao: number | undefined
): { date: Date | null; usedFallbackYear: boolean } {
  if (v === null || v === undefined || v === "") return { date: null, usedFallbackYear: false };
  const asDate = toDate(v);
  if (asDate) return { date: asDate, usedFallbackYear: false };

  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const year = anoPadrao ?? anoEmissao;
    if (year) {
      return { date: new Date(year, Number(m[2]) - 1, Number(m[1])), usedFallbackYear: true };
    }
  }
  return { date: null, usedFallbackYear: false };
}

function fmtDateForSheet(d: Date): Date {
  // devolvemos um objeto Date puro — o writer do xlsx cuida da formatação
  return d;
}

export function convertOrders(
  rows: CellValue[][],
  mapping: ColumnMapping,
  colorTable: CodeTableEntry[],
  sizeLetters: SizeLetterEntry[],
  clients: ClientRecord[],
  options: OrderConverterOptions = DEFAULT_ORDER_OPTIONS
): ConversionResult {
  const warnings: ConversionWarning[] = [];
  const outRows: CellValue[][] = [];
  const seenSkus = new Set<string>();
  let clientesNaoEncontrados = 0;
  let tamanhosInvalidos = 0;

  rows.forEach((row, i) => {
    const rowNum = i + 2;

    const numPedido = cellToString(getCell(row, mapping, "numPedido"));
    const clienteNome = cellToString(getCell(row, mapping, "cliente"));
    const codRefRaw = cellToString(getCell(row, mapping, "codRef"));
    const descricaoRaw = cellToString(getCell(row, mapping, "descricao"));
    const tamanhoRaw = cellToString(getCell(row, mapping, "tamanho"));

    if (!numPedido && !clienteNome && !codRefRaw && !descricaoRaw) return; // linha vazia

    if (!numPedido || !clienteNome || !codRefRaw || !descricaoRaw || !tamanhoRaw) {
      warnings.push({
        rowIndex: rowNum,
        message: "Linha com campo obrigatório vazio (pedido, cliente, referência, descrição ou tamanho) — ignorada.",
      });
      return;
    }

    // ---- referência + variante fixa de cor embutida (ex: "2830/3") ----
    let baseRef = codRefRaw;
    let variantColorCode: string | null = null;
    if (codRefRaw.includes("/")) {
      const [base, variant] = codRefRaw.split("/");
      baseRef = base.trim();
      variantColorCode = variant.trim().padStart(2, "0");
    }

    // ---- tamanho ----
    const size = sizeToCode(tamanhoRaw, sizeLetters);
    if (!size) {
      warnings.push({
        rowIndex: rowNum,
        message: `Pedido ${numPedido}, ref ${codRefRaw}: tamanho "${tamanhoRaw}" não reconhecido — linha ignorada.`,
      });
      tamanhosInvalidos++;
      return;
    }

    // ---- SKU ----
    const sku = `${baseRef}${variantColorCode ?? ""}${size.code}`;
    if (seenSkus.has(`${numPedido}#${sku}`)) {
      warnings.push({ rowIndex: rowNum, message: `SKU "${sku}" repetido dentro do pedido ${numPedido}.` });
    }
    seenSkus.add(`${numPedido}#${sku}`);

    // ---- cor decorativa (aparece só na descrição, não no SKU) ----
    const corRaw = getCell(row, mapping, "cor");
    const corRawStr = cellToString(corRaw);
    let corNome: string | null = null;
    if (corRawStr !== "") {
      corNome = lookupColorName(corRawStr, colorTable);
      if (!corNome) {
        warnings.push({
          rowIndex: rowNum,
          message: `Pedido ${numPedido}, ref ${codRefRaw}: código de cor "${corRawStr}" não está na tabela de cores.`,
        });
      }
    }

    const descParts = [descricaoRaw];
    if (corNome) descParts.push(corNome);
    descParts.push(size.label);
    const descricaoFinal = descParts.join(" - ");

    // ---- cliente ----
    const client = findClient(clienteNome, clients);
    let tipoPessoa = "";
    let cpfCnpj = "";
    let ie = "";
    if (client) {
      cpfCnpj = client.cnpjOuCpf ?? "";
      ie = client.ie ?? "";
      const digits = digitsOnly(cpfCnpj);
      tipoPessoa = digits.length > 11 ? "J" : digits.length > 0 ? "F" : "";
    } else {
      clientesNaoEncontrados++;
      warnings.push({
        rowIndex: rowNum,
        message: `Cliente "${clienteNome}" não encontrado na tabela de clientes — CNPJ/IE ficarão em branco.`,
      });
    }

    // ---- datas ----
    const dataEmissao = toDate(getCell(row, mapping, "dataEmissao"));
    const anoEmissao = dataEmissao ? dataEmissao.getFullYear() : undefined;
    const { date: dataEntrega, usedFallbackYear } = parseDataEntrega(
      getCell(row, mapping, "dataEntrega"),
      options.anoPadraoEntrega,
      anoEmissao
    );
    if (usedFallbackYear) {
      warnings.push({
        rowIndex: rowNum,
        message: `Pedido ${numPedido}: "Data Entrega" veio sem ano — usei o ano ${options.anoPadraoEntrega ?? anoEmissao}.`,
      });
    }

    // ---- observações (nível pedido) ----
    let observacoes = cellToString(getCell(row, mapping, "observacoes"));
    if (options.incluirCondicaoNasObservacoes) {
      const cond = cellToString(getCell(row, mapping, "condPagamento"));
      const forma = cellToString(getCell(row, mapping, "formaPagamento"));
      const extra = [cond ? `Cond.: ${cond}` : "", forma ? `Forma: ${forma}` : ""]
        .filter(Boolean)
        .join(" | ");
      observacoes = [observacoes, extra].filter(Boolean).join(" | ");
    }

    const quantidade = Number(getCell(row, mapping, "quantidade")) || 0;
    const valorUnit = Number(getCell(row, mapping, "valorUnit")) || 0;
    const representante = cellToString(getCell(row, mapping, "representante"));

    const out = emptyOrderRow();
    out[ORDER_COL["Número do pedido"]] = numPedido;
    out[ORDER_COL["Data"]] = dataEmissao ? fmtDateForSheet(dataEmissao) : "";
    out[ORDER_COL["Data prevista"]] = dataEntrega ? fmtDateForSheet(dataEntrega) : "";
    out[ORDER_COL["Nome do contato*"]] = clienteNome;
    out[ORDER_COL["Tipo de Pessoa"]] = tipoPessoa;
    out[ORDER_COL["CPF/CNPJ"]] = cpfCnpj;
    out[ORDER_COL["RG/IE"]] = ie;
    out[ORDER_COL["Observações"]] = observacoes;
    out[ORDER_COL["Situação"]] = "Aberto";
    out[ORDER_COL["Descrição"]] = descricaoFinal;
    out[ORDER_COL["Quantidade"]] = quantidade;
    out[ORDER_COL["Valor unitário"]] = valorUnit;
    out[ORDER_COL["Vendedor"]] = representante;
    out[ORDER_COL["Código (SKU)"]] = sku;

    outRows.push(out);
  });

  return {
    headers: TINY_ORDER_HEADERS,
    rows: outRows,
    warnings,
    stats: {
      linhas: outRows.length,
      clientesNaoEncontrados,
      tamanhosInvalidos,
    },
  };
}
