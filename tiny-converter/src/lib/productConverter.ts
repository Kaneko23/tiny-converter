import type {
  CellValue,
  ColumnMapping,
  ConversionResult,
  ConversionWarning,
  CodeTableEntry,
  SizeLetterEntry,
} from "./types";
import { TINY_PRODUCT_HEADERS, PRODUCT_COL, emptyProductRow } from "./tinyFormats";
import { parseGradeRange } from "./sizeRules";
import { extractColorCodesFromText, lookupColorName } from "./colorRules";
import { lookupNcm, type NcmTableEntry } from "./ncmRules";

/** Campos que o usuário liga às colunas da planilha de origem (Mostruário). */
export const PRODUCT_FIELDS = [
  { key: "descricao", label: "Descrição do produto", required: true },
  { key: "refFinal", label: "Referência (SKU base / Ref. Final)", required: true },
  { key: "refBase", label: "Ref. Base (opcional, só informativo)", required: false },
  { key: "tecido", label: "Tecido (opcional, vai para Observações)", required: false },
  { key: "codMolde", label: "Cód. Molde (opcional, vai para Observações)", required: false },
  {
    key: "cores",
    label: "Cores disponíveis (texto com os códigos, ex: \"COR 1,2,3\")",
    required: false,
    hint: "Deixe em branco se o produto não varia por cor.",
  },
  { key: "grade", label: "Grade de tamanhos (ex: \"34 A 50\" ou \"P A G2\")", required: true },
  { key: "preco", label: "Preço (opcional)", required: false },
  { key: "notaExtra", label: "Observação extra (opcional, vai para Observações)", required: false },
] as const;

export interface ProductConverterDefaults {
  unidade: string;
  origem: string;
  cest: string;
  ncm: string;
  marca: string;
  situacao: string;
  pesoLiquido: number;
  pesoBruto: number;
  formatoEmbalagem: string;
  largura: number;
  altura: number;
  comprimento: number;
  diametro: number;
  precoPadrao: number;
}

export const ORIGEM_OPTIONS: string[] = [
  "0 - Nacional, exceto as indicadas nos códigos 3 a 5",
  "1 - Estrangeira - Importação direta, exceto a indicada no código 6",
  "2 - Estrangeira - Adquirida no mercado interno, exceto a indicada no código 7",
  "3 - Nacional, mercadoria ou bem com Conteúdo de Importação superior a 40% e inferior ou igual a 70%",
  "4 - Nacional, cuja produção tenha sido feita em conformidade com os processos produtivos básicos",
  "5 - Nacional, mercadoria ou bem com Conteúdo de Importação inferior ou igual a 40%",
  "6 - Estrangeira - Importação direta, sem similar nacional, constante em lista da CAMEX",
  "7 - Estrangeira - Adquirida no mercado interno, sem similar nacional, constante em lista da CAMEX",
  "8 - Nacional, mercadoria ou bem com Conteúdo de Importação superior a 70%",
];

export const DEFAULT_PRODUCT_DEFAULTS: ProductConverterDefaults = {
  unidade: "Pç",
  origem: ORIGEM_OPTIONS[0],
  cest: "28.039.00",
  ncm: "",
  marca: "",
  situacao: "Ativo",
  pesoLiquido: 0.4,
  pesoBruto: 0.4,
  formatoEmbalagem: "Pacote / Caixa",
  largura: 30,
  altura: 2,
  comprimento: 27,
  diametro: 0,
  precoPadrao: 0,
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

function surchargeForSize(sizeLabel: string, sizeSurcharge: Record<string, number>): number {
  return sizeSurcharge[sizeLabel.trim().toUpperCase()] ?? 0;
}

export function convertProducts(
  rows: CellValue[][],
  mapping: ColumnMapping,
  colorTable: CodeTableEntry[],
  sizeLetters: SizeLetterEntry[],
  defaults: ProductConverterDefaults,
  numericStep = 2,
  ncmTable: NcmTableEntry[] = [],
  sizeSurcharge: Record<string, number> = {}
): ConversionResult {
  const warnings: ConversionWarning[] = [];
  const outRows: CellValue[][] = [];
  const seenSkus = new Set<string>();

  let parentCount = 0;
  let childCount = 0;
  let skippedCount = 0;

  rows.forEach((row, i) => {
    const rowNum = i + 2; // +1 cabeçalho, +1 para 1-based
    const descricaoRaw = cellToString(getCell(row, mapping, "descricao"));
    const refRaw = getCell(row, mapping, "refFinal");
    const gradeRaw = cellToString(getCell(row, mapping, "grade"));

    if (!descricaoRaw && !refRaw && !gradeRaw) return; // linha totalmente vazia, ignora silenciosamente

    if (!descricaoRaw) {
      warnings.push({ rowIndex: rowNum, message: "Sem descrição — linha ignorada." });
      skippedCount++;
      return;
    }
    if (refRaw === null || refRaw === undefined || cellToString(refRaw) === "") {
      warnings.push({ rowIndex: rowNum, message: `"${descricaoRaw}": sem referência (SKU) — linha ignorada.` });
      skippedCount++;
      return;
    }
    const refFinal = cellToString(refRaw);

    const sizes = parseGradeRange(gradeRaw, { letters: sizeLetters, numericStep });
    if (!sizes || sizes.length === 0) {
      warnings.push({
        rowIndex: rowNum,
        message: `"${descricaoRaw}" (ref ${refFinal}): grade "${gradeRaw}" não reconhecida ou cancelada — linha ignorada.`,
      });
      skippedCount++;
      return;
    }

    const coresText = cellToString(getCell(row, mapping, "cores"));
    const colorCodes = extractColorCodesFromText(coresText);
    const colors: { code: string; name: string }[] = [];
    for (const code of colorCodes) {
      const name = lookupColorName(code, colorTable);
      if (name) {
        colors.push({ code: code.padStart(2, "0"), name });
      } else {
        warnings.push({
          rowIndex: rowNum,
          message: `"${descricaoRaw}" (ref ${refFinal}): código de cor "${code}" não está na tabela de cores — ignorado.`,
        });
      }
    }

    const tecido = cellToString(getCell(row, mapping, "tecido"));
    const codMolde = cellToString(getCell(row, mapping, "codMolde"));
    const notaExtra = cellToString(getCell(row, mapping, "notaExtra"));
    const obsParts = [
      tecido ? `Tecido: ${tecido}` : "",
      codMolde ? `Cód. Molde: ${codMolde}` : "",
      notaExtra || "",
    ].filter(Boolean);
    const observacoes = obsParts.join(" | ");

    // ---- NCM pelo tecido (tabela "Tecido -> NCM", com correspondência aproximada) ----
    let ncm = defaults.ncm;
    if (tecido) {
      const match = lookupNcm(tecido, ncmTable);
      if (!match) {
        warnings.push({
          rowIndex: rowNum,
          message: `"${descricaoRaw}": tecido "${tecido}" não encontrado na tabela de NCM — usando o NCM padrão. Confira antes de importar.`,
        });
      } else if (!match.ncm) {
        warnings.push({
          rowIndex: rowNum,
          message: `"${descricaoRaw}": tecido "${tecido}" está na tabela de NCM mas sem código cadastrado — usando o NCM padrão.`,
        });
      } else {
        ncm = match.ncm;
        if (!match.exact) {
          warnings.push({
            rowIndex: rowNum,
            message: `"${descricaoRaw}": tecido "${tecido}" reconhecido como "${match.matchedTecido}" (correspondência aproximada) — NCM ${match.ncm}, confira se está certo.`,
          });
        }
      }
    }

    const precoCell = getCell(row, mapping, "preco");
    const preco =
      precoCell !== null && precoCell !== undefined && cellToString(precoCell) !== ""
        ? Number(precoCell)
        : defaults.precoPadrao;

    const descBase = descricaoRaw.toUpperCase();
    const nVariants = (colors.length || 1) * sizes.length;
    // produto sem variação (um tamanho só) -> a linha "pai" é a própria SKU vendável,
    // então já aplica o acréscimo do tamanho nela também.
    const precoPai = nVariants <= 1 && sizes.length === 1 ? preco + surchargeForSize(sizes[0].label, sizeSurcharge) : preco;

    const parent = emptyProductRow();
    parent[PRODUCT_COL["Código (SKU)"]] = refFinal;
    parent[PRODUCT_COL["Descrição"]] = descBase;
    parent[PRODUCT_COL["Unidade"]] = defaults.unidade;
    parent[PRODUCT_COL["Origem"]] = defaults.origem;
    parent[PRODUCT_COL["Preço"]] = precoPai;
    parent[PRODUCT_COL["Valor IPI fixo"]] = 0;
    parent[PRODUCT_COL["Observações"]] = observacoes;
    parent[PRODUCT_COL["Situação"]] = defaults.situacao;
    parent[PRODUCT_COL["Estoque"]] = 0;
    parent[PRODUCT_COL["Preço de custo"]] = 0;
    parent[PRODUCT_COL["Estoque máximo"]] = 0;
    parent[PRODUCT_COL["Estoque mínimo"]] = 0;
    parent[PRODUCT_COL["Peso líquido (Kg)"]] = defaults.pesoLiquido;
    parent[PRODUCT_COL["Peso bruto (Kg)"]] = defaults.pesoBruto;
    parent[PRODUCT_COL["CEST"]] = defaults.cest;
    parent[PRODUCT_COL["Formato embalagem"]] = defaults.formatoEmbalagem;
    parent[PRODUCT_COL["Largura embalagem"]] = defaults.largura;
    parent[PRODUCT_COL["Altura embalagem"]] = defaults.altura;
    parent[PRODUCT_COL["Comprimento embalagem"]] = defaults.comprimento;
    parent[PRODUCT_COL["Diâmetro embalagem"]] = defaults.diametro;
    parent[PRODUCT_COL["Classificação fiscal"]] = ncm;
    parent[PRODUCT_COL["Tipo do produto"]] = nVariants > 1 ? "V" : "S";
    parent[PRODUCT_COL["Marca"]] = defaults.marca;
    parent[PRODUCT_COL["Sob encomenda"]] = "Não";
    parent[PRODUCT_COL["Preço promocional"]] = 0;
    parent[PRODUCT_COL["Dias para preparação"]] = 0;
    parent[PRODUCT_COL["Controlar lotes"]] = "não";
    parent[PRODUCT_COL["Markup"]] = 0;
    parent[PRODUCT_COL["Permitir inclusão nas vendas"]] = "Sim";

    if (seenSkus.has(refFinal)) {
      warnings.push({ rowIndex: rowNum, message: `SKU "${refFinal}" duplicado (referência repetida).` });
    }
    seenSkus.add(refFinal);
    outRows.push(parent);
    parentCount++;

    if (nVariants <= 1) return; // produto simples, sem variações — só a linha "pai" já basta

    const colorList = colors.length ? colors : [{ code: "", name: "" }];
    for (const color of colorList) {
      for (const size of sizes) {
        const skuStr = `${refFinal}${color.code}${size.code}`;
        const precoFilho = preco + surchargeForSize(size.label, sizeSurcharge);
        const child = emptyProductRow();
        child[PRODUCT_COL["Código (SKU)"]] = skuStr;
        child[PRODUCT_COL["Descrição"]] = color.name ? `${descBase} ${color.name}` : descBase;
        child[PRODUCT_COL["Unidade"]] = defaults.unidade;
        child[PRODUCT_COL["Origem"]] = defaults.origem;
        child[PRODUCT_COL["Preço"]] = precoFilho;
        child[PRODUCT_COL["Valor IPI fixo"]] = 0;
        child[PRODUCT_COL["Observações"]] = observacoes;
        child[PRODUCT_COL["Situação"]] = defaults.situacao;
        child[PRODUCT_COL["Estoque"]] = 0;
        child[PRODUCT_COL["Preço de custo"]] = 0;
        child[PRODUCT_COL["Estoque máximo"]] = 0;
        child[PRODUCT_COL["Estoque mínimo"]] = 0;
        child[PRODUCT_COL["Peso líquido (Kg)"]] = defaults.pesoLiquido;
        child[PRODUCT_COL["Peso bruto (Kg)"]] = defaults.pesoBruto;
        child[PRODUCT_COL["CEST"]] = defaults.cest;
        child[PRODUCT_COL["Formato embalagem"]] = defaults.formatoEmbalagem;
        child[PRODUCT_COL["Largura embalagem"]] = defaults.largura;
        child[PRODUCT_COL["Altura embalagem"]] = defaults.altura;
        child[PRODUCT_COL["Comprimento embalagem"]] = defaults.comprimento;
        child[PRODUCT_COL["Diâmetro embalagem"]] = defaults.diametro;
        child[PRODUCT_COL["Classificação fiscal"]] = ncm;
        child[PRODUCT_COL["Tipo do produto"]] = "S";
        child[PRODUCT_COL["Código do pai"]] = refFinal;
        child[PRODUCT_COL["Variações"]] = color.name
          ? `Cores:${color.name}||Tamanho:${size.label}||`
          : `Tamanho:${size.label}||`;
        child[PRODUCT_COL["Marca"]] = defaults.marca;
        child[PRODUCT_COL["Sob encomenda"]] = "Não";
        child[PRODUCT_COL["Preço promocional"]] = 0;
        child[PRODUCT_COL["Dias para preparação"]] = 0;
        child[PRODUCT_COL["Controlar lotes"]] = "não";
        child[PRODUCT_COL["Markup"]] = 0;
        child[PRODUCT_COL["Permitir inclusão nas vendas"]] = "Sim";

        if (seenSkus.has(skuStr)) {
          warnings.push({ rowIndex: rowNum, message: `SKU "${skuStr}" duplicado.` });
        }
        seenSkus.add(skuStr);
        outRows.push(child);
        childCount++;
      }
    }
  });

  return {
    headers: TINY_PRODUCT_HEADERS,
    rows: outRows,
    warnings,
    stats: {
      produtosPai: parentCount,
      variacoes: childCount,
      linhasIgnoradas: skippedCount,
      totalLinhas: outRows.length,
    },
  };
}
