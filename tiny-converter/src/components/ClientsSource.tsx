import { useMemo, useState } from "react";
import { FileDropzone } from "./FileDropzone";
import { SheetPicker } from "./SheetPicker";
import { ColumnMapper, autoMapColumns } from "./ColumnMapper";
import { readWorkbookFile, sliceSheetFromHeaderRow } from "../lib/xlsxIO";
import type { CellValue, ColumnMapping, WorkbookData } from "../lib/types";
import type { ClientRecord } from "../lib/orderConverter";
import { isSupabaseConfigured } from "../supabase/client";
import { listClients, upsertClients } from "../supabase/repositories";

const CLIENT_FIELDS = [
  { key: "nomeFantasia", label: "Nome (fantasia) — como aparece no pedido", required: true },
  { key: "razaoSocial", label: "Razão Social", required: false },
  { key: "cnpjOuCpf", label: "CNPJ / CPF", required: false },
  { key: "ie", label: "Insc. Estadual / RG", required: false },
  { key: "endereco", label: "Endereço", required: false },
  { key: "cidade", label: "Cidade", required: false },
  { key: "bairro", label: "Bairro", required: false },
  { key: "uf", label: "UF", required: false },
  { key: "cep", label: "CEP", required: false },
  { key: "email", label: "E-mail", required: false },
  { key: "telefone", label: "Telefone", required: false },
  { key: "contato", label: "Contato", required: false },
] as const;

function cellStr(v: CellValue): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v).trim();
}

interface Props {
  clients: ClientRecord[];
  onClientsChange: (clients: ClientRecord[]) => void;
}

export function ClientsSource({ clients, onClientsChange }: Props) {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(1);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [loadingDb, setLoadingDb] = useState(false);
  const [savingDb, setSavingDb] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
  }

  function applyMappingToClients() {
    if (!activeSheet) return;
    const list: ClientRecord[] = [];
    for (const row of activeSheet.rows) {
      const get = (key: string) => {
        const idx = mapping[key];
        return idx === null || idx === undefined ? undefined : cellStr(row[idx]);
      };
      const nomeFantasia = get("nomeFantasia");
      if (!nomeFantasia) continue;
      list.push({
        nomeFantasia,
        razaoSocial: get("razaoSocial"),
        cnpjOuCpf: get("cnpjOuCpf"),
        ie: get("ie"),
      });
    }
    onClientsChange(list);
    setMsg(`${list.length} clientes carregados da planilha.`);
  }

  async function loadFromDb() {
    setLoadingDb(true);
    setMsg(null);
    try {
      const list = await listClients();
      onClientsChange(list);
      setMsg(`${list.length} clientes carregados do Supabase.`);
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`);
    } finally {
      setLoadingDb(false);
    }
  }

  async function saveToDb() {
    if (!activeSheet) return;
    setSavingDb(true);
    setMsg(null);
    try {
      const rows = activeSheet.rows
        .map((row) => {
          const get = (key: string) => {
            const idx = mapping[key];
            return idx === null || idx === undefined ? undefined : cellStr(row[idx]);
          };
          const nomeFantasia = get("nomeFantasia");
          if (!nomeFantasia) return null;
          return {
            nomeFantasia,
            razaoSocial: get("razaoSocial"),
            cnpjOuCpf: get("cnpjOuCpf"),
            ie: get("ie"),
            endereco: get("endereco"),
            cidade: get("cidade"),
            bairro: get("bairro"),
            uf: get("uf"),
            cep: get("cep"),
            email: get("email"),
            telefone: get("telefone"),
            contato: get("contato"),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      const count = await upsertClients(rows);
      setMsg(`${count} clientes salvos/atualizados no Supabase.`);
    } catch (e) {
      setMsg(`Erro ao salvar: ${(e as Error).message}`);
    } finally {
      setSavingDb(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-800">Clientes (para CNPJ / Insc. Estadual)</h3>
        <span className="text-xs text-gray-400">{clients.length} carregados</span>
      </div>
      <p className="text-xs text-gray-400">
        Usado para preencher Tipo de Pessoa, CPF/CNPJ e RG/IE a partir do nome do cliente no pedido.
        Se um cliente não for encontrado, essas colunas ficam em branco e um aviso aparece no resultado.
      </p>

      {isSupabaseConfigured && (
        <button
          onClick={loadFromDb}
          disabled={loadingDb}
          className="rounded-md border border-brand-200 px-3 py-1 text-sm text-brand-600 hover:bg-brand-50 disabled:opacity-50"
        >
          {loadingDb ? "Carregando..." : "Carregar clientes salvos no Supabase"}
        </button>
      )}

      <FileDropzone onFile={handleFile} label="Ou envie a planilha de Clientes" fileName={workbook?.fileName} />

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
          <div className="flex justify-end">
            <button
              onClick={() => setMapping(autoMapColumns(activeSheet.headers, CLIENT_FIELDS))}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              Detectar colunas automaticamente
            </button>
          </div>
          <ColumnMapper
            headers={activeSheet.headers}
            previewRows={activeSheet.rows}
            fields={CLIENT_FIELDS}
            mapping={mapping}
            onChange={setMapping}
          />
          <div className="flex gap-2">
            <button
              onClick={applyMappingToClients}
              className="rounded-md bg-brand-500 px-3 py-1.5 text-sm text-white hover:bg-brand-600"
            >
              Usar esses clientes
            </button>
            {isSupabaseConfigured && (
              <button
                onClick={saveToDb}
                disabled={savingDb}
                className="rounded-md border border-brand-300 px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                {savingDb ? "Salvando..." : "Salvar no Supabase para próxima vez"}
              </button>
            )}
          </div>
        </>
      )}

      {msg && <p className="text-sm text-gray-500">{msg}</p>}
    </div>
  );
}
