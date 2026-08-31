import type { CellValue, ColumnMapping, FieldSpec } from "../lib/types";

interface Props {
  headers: string[];
  previewRows: CellValue[][];
  fields: readonly FieldSpec[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

function formatPreviewValue(v: CellValue): string {
  return v instanceof Date ? v.toLocaleDateString("pt-BR") : String(v);
}

function previewFor(previewRows: CellValue[][], colIndex: number): string {
  const vals = previewRows
    .slice(0, 3)
    .map((r) => r[colIndex])
    .filter((v) => v !== null && v !== undefined && v !== "");
  return vals.length ? vals.map(formatPreviewValue).join(" · ") : "—";
}

export function ColumnMapper({ headers, previewRows, fields, mapping, onChange }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-2 font-medium">Campo do Tiny</th>
            <th className="px-4 py-2 font-medium">Coluna na sua planilha</th>
            <th className="px-4 py-2 font-medium">Prévia</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => {
            const idx = mapping[f.key];
            return (
              <tr key={f.key} className="border-t border-gray-100">
                <td className="px-4 py-2">
                  <span className="font-medium text-gray-800">{f.label}</span>
                  {f.required && <span className="ml-1 text-red-500">*</span>}
                  {f.hint && <div className="text-xs text-gray-400">{f.hint}</div>}
                </td>
                <td className="px-4 py-2">
                  <select
                    className="w-56 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    value={idx === null || idx === undefined ? "" : idx}
                    onChange={(e) =>
                      onChange({
                        ...mapping,
                        [f.key]: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  >
                    <option value="">— não usar —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {idx !== null && idx !== undefined ? previewFor(previewRows, idx) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Tenta casar automaticamente os cabeçalhos da planilha com os campos esperados, por nome parecido. */
export function autoMapColumns(headers: string[], fields: readonly FieldSpec[]): ColumnMapping {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const normHeaders = headers.map(norm);
  const mapping: ColumnMapping = {};

  const synonyms: Record<string, string[]> = {
    descricao: ["descricao", "descrisao", "produto", "nomedoproduto"],
    refFinal: ["reffinal", "referencia", "ref", "codref", "codigo", "sku"],
    refBase: ["refbase"],
    tecido: ["tecido"],
    codMolde: ["codmolde", "codigomolde"],
    cores: ["obs", "cores", "cor"],
    grade: ["grade", "tamanhos", "grademanho"],
    preco: ["preco", "valor", "valorunit", "valorunitario"],
    notaExtra: ["nota", "observacao", "observacoes"],
    numPedido: ["numeropedido", "nopedido", "pedido", "npedido"],
    cliente: ["cliente"],
    dataEmissao: ["dataemissao", "data"],
    dataEntrega: ["dataentrega"],
    representante: ["representante", "vendedor"],
    codRef: ["codref", "referencia", "ref"],
    cor: ["cor"],
    tamanho: ["tamanho"],
    quantidade: ["quant", "quantidade", "qtd"],
    valorUnit: ["valorunit", "valorunitario", "preco"],
    condPagamento: ["condpagamento", "condicaodepagamento"],
    formaPagamento: ["formadepagamento", "formapagamento"],
    observacoes: ["observacoes", "obs"],
    // campos da tabela de clientes (ClientsSource)
    nomeFantasia: ["nomefantasia", "fantasia", "nome"],
    razaoSocial: ["razaosocial", "razao"],
    cnpjOuCpf: ["cnpjcpf", "cnpj", "cpf"],
    ie: ["inscricaoestadual", "inscest", "insc", "rg", "ie"],
    endereco: ["endereco"],
    cidade: ["cidade"],
    bairro: ["bairro"],
    uf: ["uf", "estado"],
    cep: ["cep"],
    email: ["email", "mail"],
    telefone: ["telefone", "fone", "celular"],
    contato: ["contato"],
  };

  for (const f of fields) {
    const options = synonyms[f.key] ?? [norm(f.label)];
    let found = -1;
    for (const opt of options) {
      found = normHeaders.findIndex((h) => h === opt);
      if (found !== -1) break;
    }
    if (found === -1) {
      for (const opt of options) {
        // cabeçalho contém o sinônimo (ex: "Insc. Est." contém "insc")
        found = normHeaders.findIndex((h) => h.includes(opt));
        if (found !== -1) break;
      }
    }
    mapping[f.key] = found === -1 ? null : found;
  }

  return mapping;
}
