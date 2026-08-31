import { useMemo, useState } from "react";
import { FileDropzone } from "../components/FileDropzone";
import { SheetPicker } from "../components/SheetPicker";
import { ColumnMapper, autoMapColumns } from "../components/ColumnMapper";
import { CodeTableEditor } from "../components/CodeTableEditor";
import { ResultsPanel } from "../components/ResultsPanel";
import { ClientsSource } from "../components/ClientsSource";
import { readWorkbookFile, sliceSheetFromHeaderRow } from "../lib/xlsxIO";
import { convertOrders, ORDER_FIELDS, type ClientRecord } from "../lib/orderConverter";
import { DEFAULT_SIZE_LETTERS } from "../lib/sizeRules";
import { ORDER_COL } from "../lib/tinyFormats";
import type { ColumnMapping, WorkbookData, CodeTableEntry, ConversionResult, CellValue } from "../lib/types";
import { logConversion } from "../supabase/repositories";
import { isSupabaseConfigured } from "../supabase/client";

export function OrdersPage() {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(1);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [colorRows, setColorRows] = useState<{ a: string; b: string }[]>([
    { a: "1", b: "Preto" },
    { a: "2", b: "Branco" },
    { a: "3", b: "Azul" },
    { a: "4", b: "Verde" },
    { a: "5", b: "Rosa" },
    { a: "6", b: "Amarelo" },
    { a: "7", b: "Roxo" },
    { a: "8", b: "Bege" },
    { a: "9", b: "Marrom" },
  ]);
  const [sizeRows, setSizeRows] = useState<{ a: string; b: string }[]>(
    DEFAULT_SIZE_LETTERS.map((s) => ({ a: s.label, b: s.code }))
  );
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [incluirCondicao, setIncluirCondicao] = useState(false);
  const [anoPadraoEntrega, setAnoPadraoEntrega] = useState<string>("");
  const [result, setResult] = useState<ConversionResult | null>(null);

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

  function handleAutoMap() {
    if (!activeSheet) return;
    setMapping(autoMapColumns(activeSheet.headers, ORDER_FIELDS));
  }

  const colorTable: CodeTableEntry[] = colorRows
    .filter((r) => r.a && r.b)
    .map((r) => ({ code: r.a, name: r.b }));
  const sizeLetters = sizeRows
    .filter((r) => r.a && r.b)
    .map((r) => ({ label: r.a, code: r.b.padStart(2, "0") }));

  function handleConvert() {
    if (!activeSheet) return;
    const res = convertOrders(activeSheet.rows, mapping, colorTable, sizeLetters, clients, {
      incluirCondicaoNasObservacoes: incluirCondicao,
      anoPadraoEntrega: anoPadraoEntrega ? Number(anoPadraoEntrega) : undefined,
    });
    setResult(res);
    if (isSupabaseConfigured) {
      logConversion("pedidos", workbook?.fileName ?? "", res.rows.length, res.warnings.length).catch(() => {});
    }
  }

  function orderGroupKey(row: CellValue[]): string {
    return String(row[ORDER_COL["Número do pedido"]] ?? "");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">1. Envie a planilha de pedidos</h2>
        <p className="text-sm text-gray-500">
          O histórico de pedidos, com uma linha por item (referência, cor, tamanho, quantidade, valor).
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
            onSelect={(i) => {
              setSheetIndex(i);
              setHeaderRow(1);
            }}
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
              fields={ORDER_FIELDS}
              mapping={mapping}
              onChange={setMapping}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <CodeTableEditor
              title='Tabela de cores (coluna "Cor" do pedido)'
              hint="Só usada para completar o texto da Descrição — não entra no SKU."
              colA={{ key: "a", label: "Código", placeholder: "1" }}
              colB={{ key: "b", label: "Nome da cor", placeholder: "Preto" }}
              rows={colorRows}
              onChange={setColorRows}
            />
            <CodeTableEditor
              title="Tamanhos em letra"
              hint="Precisa ser igual à tabela usada no cadastro de produtos."
              colA={{ key: "a", label: "Tamanho", placeholder: "P" }}
              colB={{ key: "b", label: "Código no SKU", placeholder: "01" }}
              rows={sizeRows}
              onChange={setSizeRows}
            />
          </div>

          <ClientsSource clients={clients} onClientsChange={setClients} />

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 font-medium text-gray-800">Opções</h3>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={incluirCondicao}
                  onChange={(e) => setIncluirCondicao(e.target.checked)}
                />
                Incluir condição/forma de pagamento nas Observações do pedido
              </label>
              <label className="text-sm text-gray-600">
                Ano para completar "Data Entrega" sem ano (ex: "15/04"):
                <input
                  type="number"
                  placeholder="ex: 2027"
                  className="ml-2 w-24 rounded-md border border-gray-300 px-2 py-1"
                  value={anoPadraoEntrega}
                  onChange={(e) => setAnoPadraoEntrega(e.target.value)}
                />
              </label>
            </div>
          </div>

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
          <ResultsPanel
            result={result}
            fileLabel="planilha de pedidos"
            sheetName="Tiny"
            fileBaseName="pedidos-tiny"
            groupKeyFn={orderGroupKey}
          />
        </div>
      )}
    </div>
  );
}
