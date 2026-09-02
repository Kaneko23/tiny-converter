import { useEffect, useMemo, useState } from "react";
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

const EMPTY_DRAFT: ClientRecord = {
  nomeFantasia: "",
  razaoSocial: "",
  cnpjOuCpf: "",
  ie: "",
  endereco: "",
  cidade: "",
  bairro: "",
  uf: "",
  cep: "",
  email: "",
  telefone: "",
  contato: "",
};

export function ClientsSource({ clients, onClientsChange }: Props) {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(1);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [loadingDb, setLoadingDb] = useState(false);
  const [savingDb, setSavingDb] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClientRecord>(EMPTY_DRAFT);
  const [addingClient, setAddingClient] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Com Supabase configurado, já puxa os clientes salvos assim que a tela abre —
  // assim o próximo pedido já reconhece o cliente sem precisar clicar em nada.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listClients();
        if (!cancelled && list.length) onClientsChange(list);
      } catch {
        // silencioso — se falhar, a pessoa ainda pode carregar manualmente pelo botão
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        endereco: get("endereco"),
        cidade: get("cidade"),
        bairro: get("bairro"),
        uf: get("uf"),
        cep: get("cep"),
        email: get("email"),
        telefone: get("telefone"),
        contato: get("contato"),
      });
    }
    onClientsChange(list);
    setMsg(`${list.length} clientes carregados da planilha.`);
  }

  async function handleAddClient() {
    const nomeFantasia = draft.nomeFantasia.trim();
    if (!nomeFantasia) {
      setAddMsg("Preencha ao menos o nome (fantasia) do cliente.");
      return;
    }
    const record: ClientRecord = { ...draft, nomeFantasia };
    setAddingClient(true);
    setAddMsg(null);
    try {
      if (isSupabaseConfigured) {
        await upsertClients([record]);
      }
      const key = nomeFantasia.toLowerCase();
      const idx = clients.findIndex((c) => c.nomeFantasia.trim().toLowerCase() === key);
      const next = idx >= 0 ? clients.map((c, i) => (i === idx ? record : c)) : [...clients, record];
      onClientsChange(next);
      setDraft(EMPTY_DRAFT);
      setAddMsg(
        isSupabaseConfigured
          ? `Cliente "${nomeFantasia}" salvo no Supabase.`
          : `Cliente "${nomeFantasia}" adicionado (só nesta sessão — configure o Supabase para salvar de vez).`
      );
    } catch (e) {
      setAddMsg(`Erro ao salvar: ${(e as Error).message}`);
    } finally {
      setAddingClient(false);
    }
  }

  function handleRemoveClient(index: number) {
    onClientsChange(clients.filter((_, i) => i !== index));
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
    <div className="space-y-3 rounded-sm border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-ink">Clientes (para CNPJ / Insc. Estadual)</h3>
        <span className="text-xs text-muted">{clients.length} carregados</span>
      </div>
      <p className="text-xs text-muted">
        Usado para preencher Tipo de Pessoa, CPF/CNPJ, RG/IE e o endereço a partir do nome do cliente
        no pedido. {isSupabaseConfigured ? "Com o Supabase configurado, isso já fica salvo pro próximo pedido reconhecer sozinho." : ""}{" "}
        Se um cliente não for encontrado, essas colunas ficam em branco e um aviso aparece no resultado.
      </p>

      <div className="flex flex-wrap gap-2">
        {isSupabaseConfigured && (
          <button
            onClick={loadFromDb}
            disabled={loadingDb}
            className="rounded-full border border-brand-200 px-3.5 py-1 text-sm text-brand-600 hover:bg-brand-50 disabled:opacity-50"
          >
            {loadingDb ? "Carregando..." : "Recarregar clientes salvos no Supabase"}
          </button>
        )}
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="rounded-full border border-line px-3.5 py-1 text-sm text-ink hover:border-brand-300"
        >
          {formOpen ? "Fechar cadastro" : "+ Cadastrar cliente manualmente"}
        </button>
      </div>

      {formOpen && (
        <div className="space-y-2 rounded-sm bg-paper p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <ClientField label="Nome (fantasia)*" value={draft.nomeFantasia} onChange={(v) => setDraft({ ...draft, nomeFantasia: v })} />
            <ClientField label="Razão Social" value={draft.razaoSocial ?? ""} onChange={(v) => setDraft({ ...draft, razaoSocial: v })} />
            <ClientField label="CNPJ / CPF" value={draft.cnpjOuCpf ?? ""} onChange={(v) => setDraft({ ...draft, cnpjOuCpf: v })} />
            <ClientField label="Insc. Estadual / RG" value={draft.ie ?? ""} onChange={(v) => setDraft({ ...draft, ie: v })} />
            <ClientField label="Endereço" value={draft.endereco ?? ""} onChange={(v) => setDraft({ ...draft, endereco: v })} />
            <ClientField label="Cidade" value={draft.cidade ?? ""} onChange={(v) => setDraft({ ...draft, cidade: v })} />
            <ClientField label="Bairro" value={draft.bairro ?? ""} onChange={(v) => setDraft({ ...draft, bairro: v })} />
            <ClientField label="UF" value={draft.uf ?? ""} onChange={(v) => setDraft({ ...draft, uf: v })} />
            <ClientField label="CEP" value={draft.cep ?? ""} onChange={(v) => setDraft({ ...draft, cep: v })} />
            <ClientField label="E-mail" value={draft.email ?? ""} onChange={(v) => setDraft({ ...draft, email: v })} />
            <ClientField label="Telefone" value={draft.telefone ?? ""} onChange={(v) => setDraft({ ...draft, telefone: v })} />
            <ClientField label="Contato" value={draft.contato ?? ""} onChange={(v) => setDraft({ ...draft, contato: v })} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddClient}
              disabled={addingClient}
              className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-paper hover:bg-brand-700 disabled:opacity-50"
            >
              {addingClient ? "Salvando..." : isSupabaseConfigured ? "Salvar cliente no Supabase" : "Adicionar cliente"}
            </button>
            {addMsg && <span className="text-xs text-muted">{addMsg}</span>}
          </div>
        </div>
      )}

      {clients.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-sm border border-line">
          <table className="w-full text-xs">
            <tbody>
              {clients.map((c, i) => (
                <tr key={`${i}-${c.nomeFantasia}`} className="border-t border-line/70 first:border-t-0">
                  <td className="px-2 py-1 font-medium text-ink">{c.nomeFantasia}</td>
                  <td className="px-2 py-1 text-muted">{c.cnpjOuCpf || "—"}</td>
                  <td className="px-2 py-1 text-muted">{c.cidade || "—"}</td>
                  <td className="w-6 px-2 py-1 text-right">
                    <button
                      onClick={() => handleRemoveClient(i)}
                      className="text-muted hover:text-brand-600"
                      title="Remover da lista (não apaga do Supabase)"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
              className="rounded-full border border-line px-2.5 py-1 text-xs text-ink hover:border-brand-300"
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
              className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-paper hover:bg-brand-700"
            >
              Usar esses clientes
            </button>
            {isSupabaseConfigured && (
              <button
                onClick={saveToDb}
                disabled={savingDb}
                className="rounded-full border border-brand-300 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                {savingDb ? "Salvando..." : "Salvar no Supabase para próxima vez"}
              </button>
            )}
          </div>
        </>
      )}

      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}

function ClientField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-xs">
      <div className="mb-0.5 text-muted">{label}</div>
      <input
        className="w-full rounded-sm border border-line bg-card px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
