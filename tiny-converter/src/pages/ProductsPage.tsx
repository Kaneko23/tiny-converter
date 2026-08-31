import { useMemo, useState } from "react";
import { FileDropzone } from "../components/FileDropzone";
import { SheetPicker } from "../components/SheetPicker";
import { ColumnMapper, autoMapColumns } from "../components/ColumnMapper";
import { CodeTableEditor } from "../components/CodeTableEditor";
import { ResultsPanel } from "../components/ResultsPanel";
import { readWorkbookFile, sliceSheetFromHeaderRow, buildMultiSheetXlsxBlob, downloadBlob } from "../lib/xlsxIO";
import {
  convertProducts,
  PRODUCT_FIELDS,
  DEFAULT_PRODUCT_DEFAULTS,
  ORIGEM_OPTIONS,
  type ProductConverterDefaults,
} from "../lib/productConverter";
import { DEFAULT_SIZE_LETTERS } from "../lib/sizeRules";
import { DEFAULT_NCM_ROWS, type NcmTableEntry } from "../lib/ncmRules";
import type { ColumnMapping, WorkbookData, CodeTableEntry, ConversionResult } from "../lib/types";
import { isSupabaseConfigured } from "../supabase/client";
import { saveProductCatalog, logConversion } from "../supabase/repositories";
import { PRODUCT_COL } from "../lib/tinyFormats";

export function ProductsPage() {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(1);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [colorRows, setColorRows] = useState<{ a: string; b: string }[]>([
    { a: "1", b: "Branco" },
    { a: "2", b: "Preto" },
  ]);
  const [sizeRows, setSizeRows] = useState<{ a: string; b: string }[]>(
    DEFAULT_SIZE_LETTERS.map((s) => ({ a: s.label, b: s.code }))
  );
  const [ncmRows, setNcmRows] = useState<{ a: string; b: string }[]>(DEFAULT_NCM_ROWS);
  const [numericStep, setNumericStep] = useState(2);
  const [defaults, setDefaults] = useState<ProductConverterDefaults>(DEFAULT_PRODUCT_DEFAULTS);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState("");

  const activeSheet = useMemo(() => {
    if (!workbook) return null;
    const raw = workbook.sheets[sheetIndex];
    if (!raw) return null;
    return sliceSheetFromHeaderRow(raw, headerRow);
  }, [workbook, sheetIndex, headerRow]);

  async function handleFile(file: File) {
    const wb = await readWorkbookFile(file);
    setWorkbook(wb);
    setSheetIndex(0);
    setHeaderRow(1);
    setResult(null);
  }

  function handleSheetChange(i: number) {
    setSheetIndex(i);
    setHeaderRow(1);
  }

  function handleAutoMap() {
    if (!activeSheet) return;
    setMapping(autoMapColumns(activeSheet.headers, PRODUCT_FIELDS));
  }

  const colorTable: CodeTableEntry[] = colorRows
    .filter((r) => r.a && r.b)
    .map((r) => ({ code: r.a, name: r.b }));

  const sizeLetters = sizeRows
    .filter((r) => r.a && r.b)
    .map((r) => ({ label: r.a, code: r.b.padStart(2, "0") }));

  // linhas de cabeçalho coladas junto com a lista (ex: "CANATIBA DENIM" / "ncm") não têm
  // dígito nenhum na 2ª coluna — descartamos aqui pra não sujar a correspondência.
  const ncmTable: NcmTableEntry[] = ncmRows
    .filter((r) => r.a && (!r.b || /\d/.test(r.b)))
    .map((r) => ({ tecido: r.a, ncm: r.b }));

  function handleConvert() {
    if (!activeSheet) return;
    const res = convertProducts(
      activeSheet.rows,
      mapping,
      colorTable,
      sizeLetters,
      defaults,
      numericStep,
      ncmTable
    );
    setResult(res);
    setSaveMsg(null);
  }

  function handleDownload() {
    if (!result) return;
    const blob = buildMultiSheetXlsxBlob([
      { name: "Produtos Tiny", headers: result.headers, rows: result.rows },
      {
        name: "Leia-me",
        headers: ["Notas"],
        rows: [
          [`Gerado pelo Conversor Tiny — Lei Atual Jeans`],
          [`Total de linhas: ${result.rows.length}`],
          [`Avisos: ${result.warnings.length}`],
        ],
      },
    ]);
    downloadBlob(blob, `produtos-tiny${collectionName ? `-${collectionName}` : ""}.xlsx`);
  }

  async function handleSaveCatalog() {
    if (!result) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const rows = result.rows.map((r) => ({
        sku: String(r[PRODUCT_COL["Código (SKU)"]] ?? ""),
        parentSku:
          r[PRODUCT_COL["Código do pai"]] !== "" && r[PRODUCT_COL["Código do pai"]] != null
            ? String(r[PRODUCT_COL["Código do pai"]])
            : null,
        descricao: String(r[PRODUCT_COL["Descrição"]] ?? ""),
        preco: Number(r[PRODUCT_COL["Preço"]] ?? 0),
      }));
      const count = await saveProductCatalog(collectionName || "sem nome", rows);
      await logConversion("produtos", workbook?.fileName ?? "", result.rows.length, result.warnings.length);
      setSaveMsg(`${count} produtos salvos no catálogo (Supabase).`);
    } catch (e) {
      setSaveMsg(`Erro ao salvar: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">1. Envie a planilha de produtos</h2>
        <p className="text-sm text-gray-500">
          A planilha com Descrição, Referência, Tecido, Cores e Grade de tamanhos (ex: Mostruário).
        </p>
        <div className="mt-3">
          <FileDropzone onFile={handleFile} fileName={workbook?.fileName} />
        </div>
      </div>

      {workbook && activeSheet && (
        <>
          <SheetPicker
            sheets={workbook.sheets}
            selectedIndex={sheetIndex}
            onSelect={handleSheetChange}
            headerRow={headerRow}
            onHeaderRowChange={setHeaderRow}
          />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">2. Ligue as colunas</h2>
              <button
                onClick={handleAutoMap}
                className="rounded-md border border-brand-200 px-3 py-1 text-sm text-brand-600 hover:bg-brand-50"
              >
                Tentar detectar automaticamente
              </button>
            </div>
            <ColumnMapper
              headers={activeSheet.headers}
              previewRows={activeSheet.rows}
              fields={PRODUCT_FIELDS}
              mapping={mapping}
              onChange={setMapping}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <CodeTableEditor
              title="Tabela de cores desta coleção"
              hint='Código que aparece na coluna de cores (ex: "COR 1,2,3") -> nome da cor.'
              colA={{ key: "a", label: "Código", placeholder: "1" }}
              colB={{ key: "b", label: "Nome da cor", placeholder: "Branco" }}
              rows={colorRows}
              onChange={setColorRows}
            />
            <CodeTableEditor
              title="Tamanhos em letra"
              hint="Ordem em que aparecem na grade (P antes de M, antes de G...) e o código de 2 dígitos usado no SKU."
              colA={{ key: "a", label: "Tamanho", placeholder: "P" }}
              colB={{ key: "b", label: "Código no SKU", placeholder: "01" }}
              rows={sizeRows}
              onChange={setSizeRows}
            />
          </div>

          <CodeTableEditor
            title="Tabela de NCM por tecido"
            hint='Nome do tecido (coluna "Tecido") -> NCM. A busca ignora maiúscula/minúscula, acentos e pequenas diferenças de grafia (ex: "TRIPLO" casa com "TRIPLE"), mas nunca troca uma palavra por outra bem diferente — se o tecido não for reconhecido, o NCM padrão é usado e um aviso aparece no resultado. Deixe o NCM em branco pra um tecido que ainda não foi classificado.'
            colA={{ key: "a", label: "Tecido", placeholder: "ex: XHAKA" }}
            colB={{ key: "b", label: "NCM", placeholder: "ex: 52094210 (deixe em branco se ainda não souber)" }}
            rows={ncmRows}
            onChange={setNcmRows}
          />

          <details className="rounded-lg border border-gray-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Valores padrão para os campos do Tiny (Unidade, Origem, Marca, NCM, CEST, peso, embalagem...)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <LabeledInput label="Passo entre tamanhos numéricos" value={numericStep} onChange={(v) => setNumericStep(Number(v) || 2)} type="number" />
              <LabeledInput label="Unidade" value={defaults.unidade} onChange={(v) => setDefaults({ ...defaults, unidade: v })} />
              <LabeledInput label="Situação" value={defaults.situacao} onChange={(v) => setDefaults({ ...defaults, situacao: v })} />
              <LabeledInput label="Marca" value={defaults.marca} onChange={(v) => setDefaults({ ...defaults, marca: v })} />
              <LabeledSelect
                label="Origem"
                value={defaults.origem}
                options={ORIGEM_OPTIONS}
                onChange={(v) => setDefaults({ ...defaults, origem: v })}
              />
              <LabeledInput
                label="NCM padrão (usado só quando o tecido não é encontrado na tabela acima)"
                value={defaults.ncm}
                onChange={(v) => setDefaults({ ...defaults, ncm: v })}
              />
              <LabeledInput label="CEST (padrão, igual pra todos os produtos)" value={defaults.cest} onChange={(v) => setDefaults({ ...defaults, cest: v })} />
              <LabeledInput label="Preço padrão (quando a planilha não tem preço)" type="number" value={defaults.precoPadrao} onChange={(v) => setDefaults({ ...defaults, precoPadrao: Number(v) || 0 })} />
              <LabeledInput label="Peso líquido (Kg)" type="number" value={defaults.pesoLiquido} onChange={(v) => setDefaults({ ...defaults, pesoLiquido: Number(v) || 0 })} />
              <LabeledInput label="Peso bruto (Kg)" type="number" value={defaults.pesoBruto} onChange={(v) => setDefaults({ ...defaults, pesoBruto: Number(v) || 0 })} />
              <LabeledInput label="Formato embalagem" value={defaults.formatoEmbalagem} onChange={(v) => setDefaults({ ...defaults, formatoEmbalagem: v })} />
              <LabeledInput label="Largura (cm)" type="number" value={defaults.largura} onChange={(v) => setDefaults({ ...defaults, largura: Number(v) || 0 })} />
              <LabeledInput label="Altura (cm)" type="number" value={defaults.altura} onChange={(v) => setDefaults({ ...defaults, altura: Number(v) || 0 })} />
              <LabeledInput label="Comprimento (cm)" type="number" value={defaults.comprimento} onChange={(v) => setDefaults({ ...defaults, comprimento: Number(v) || 0 })} />
              <LabeledInput label="Nome da coleção (opcional, ex: Verão 27)" value={collectionName} onChange={setCollectionName} />
            </div>
          </details>

          <button
            onClick={handleConvert}
            className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
          >
            Converter para o padrão Tiny
          </button>
        </>
      )}

      {result && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-800">3. Resultado</h2>
          <ResultsPanel result={result} onDownload={handleDownload} fileLabel="planilha de produtos" />
          {isSupabaseConfigured && (
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleSaveCatalog}
                disabled={saving}
                className="rounded-md border border-brand-300 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar catálogo no Supabase (para usar nos Pedidos)"}
              </button>
              {saveMsg && <span className="text-sm text-gray-500">{saveMsg}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="text-sm">
      <div className="mb-1 text-gray-500">{label}</div>
      <input
        type={type}
        className="w-full rounded-md border border-gray-300 px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm sm:col-span-3">
      <div className="mb-1 text-gray-500">{label}</div>
      <select
        className="w-full rounded-md border border-gray-300 px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
