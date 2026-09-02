import { useState } from "react";

interface Col {
  key: "a" | "b";
  label: string;
  placeholder?: string;
}

interface Props {
  title: string;
  hint?: string;
  colA: Col; // primeira coluna (ex: "Código")
  colB: Col; // segunda coluna (ex: "Cor" ou "Código SKU")
  rows: { a: string; b: string }[];
  onChange: (rows: { a: string; b: string }[]) => void;
}

/** Editor genérico de tabela código<->nome, usado tanto para cores quanto para tamanhos em letra. */
export function CodeTableEditor({ title, hint, colA, colB, rows, onChange }: Props) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  function updateRow(i: number, field: "a" | "b", value: string) {
    const next = rows.slice();
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  }

  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  function addRow() {
    onChange([...rows, { a: "", b: "" }]);
  }

  function applyPaste() {
    // aceita linhas "código; nome", "código - nome", "código,nome" ou "código<TAB>nome".
    // Quando a linha tem TAB (colada direto do Excel), separamos só por TAB —
    // assim um nome com vírgula dentro (ex: "NEW CETIN, PRETO Ñ DESB") não quebra ao meio.
    const parsed = pasteText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const parts = l.includes("\t")
          ? l.split("\t").map((p) => p.trim())
          : l.split(/;|,| - /).map((p) => p.trim());
        return { a: parts[0] ?? "", b: parts.slice(1).join(" ") ?? "" };
      })
      .filter((r) => r.a);
    if (parsed.length) onChange(parsed);
    setPasteText("");
    setPasteOpen(false);
  }

  return (
    <div className="rounded-sm border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink hover:border-brand-300"
        >
          Colar lista
        </button>
      </div>

      {pasteOpen && (
        <div className="mt-2 rounded-sm bg-paper p-2">
          <textarea
            className="h-24 w-full rounded-sm border border-line bg-card p-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder={`Uma por linha, ex:\n1, Branco\n2, Preto`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <button
            type="button"
            onClick={applyPaste}
            className="mt-2 rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-paper hover:bg-brand-700"
          >
            Aplicar (substitui a tabela atual)
          </button>
        </div>
      )}

      <div className="mt-3 space-y-1">
        <div className="grid grid-cols-[1fr_2fr_auto] gap-2 text-[11px] uppercase tracking-wide text-muted">
          <span>{colA.label}</span>
          <span>{colB.label}</span>
          <span></span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
            <input
              className="rounded-sm border border-line bg-card px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
              placeholder={colA.placeholder}
              value={r.a}
              onChange={(e) => updateRow(i, "a", e.target.value)}
            />
            <input
              className="rounded-sm border border-line bg-card px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
              placeholder={colB.placeholder}
              value={r.b}
              onChange={(e) => updateRow(i, "b", e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="rounded-sm px-2 text-muted hover:bg-brand-50 hover:text-brand-600"
              title="Remover"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-2 rounded-full border border-dashed border-line px-3 py-1 text-sm text-muted hover:border-brand-300 hover:text-brand-600"
      >
        + adicionar linha
      </button>
    </div>
  );
}
