import type { SizeLetterEntry } from "./types";

/** Tabela padrão de tamanhos em letra usada pela Lei Atual (igual no cadastro de produtos e nos pedidos). */
export const DEFAULT_SIZE_LETTERS: SizeLetterEntry[] = [
  { label: "P", code: "01" },
  { label: "M", code: "02" },
  { label: "G", code: "03" },
  { label: "GG", code: "04" },
  { label: "G1", code: "05" },
  { label: "G2", code: "06" },
];

export interface ParsedSize {
  label: string; // "34", "P", ...
  code: string; // sempre 2 dígitos
}

/**
 * Converte um único valor de tamanho (vindo de uma célula de pedido, ex: 36, "P", "GG")
 * no par {label, code} usado para montar o SKU e a descrição.
 */
export function sizeToCode(
  raw: string | number,
  letters: SizeLetterEntry[] = DEFAULT_SIZE_LETTERS
): ParsedSize | null {
  if (raw === null || raw === undefined) return null;
  const label = String(raw).trim().toUpperCase();
  if (label === "") return null;

  if (/^\d+$/.test(label)) {
    const n = parseInt(label, 10);
    return { label: String(n), code: String(n).padStart(2, "0") };
  }

  const found = letters.find((l) => l.label.toUpperCase() === label);
  if (found) return { label: found.label, code: found.code };

  return null; // tamanho não reconhecido — quem chamar decide como reportar
}

/**
 * Expande uma faixa de grade textual (ex: "34 A 50", "P A G2", "34 AO 44", "34A50")
 * em uma lista ordenada de tamanhos com seus códigos de 2 dígitos.
 *
 * numericStep: passo entre tamanhos numéricos (padrão 2, como é costume em moda feminina BR).
 */
export function parseGradeRange(
  raw: string,
  opts: {
    letters?: SizeLetterEntry[];
    numericStep?: number;
  } = {}
): ParsedSize[] | null {
  if (!raw) return null;
  const letters = opts.letters ?? DEFAULT_SIZE_LETTERS;
  const numericStep = opts.numericStep ?? 2;

  const g = raw.toString().trim().toUpperCase();
  if (!g) return null;
  if (g.includes("CANCEL")) return null;

  const letterLabels = new Set(letters.map((l) => l.label.toUpperCase()));
  const hasLetterToken = letters.some((l) =>
    new RegExp(`\\b${escapeRegExp(l.label.toUpperCase())}\\b`).test(g)
  );

  if (hasLetterToken) {
    // conserta "AG2" -> "A G2" (falta de espaço) antes de separar por " A " / " AO "
    const gFixed = g.replace(/\bA(G{1,2}\d?)\b/g, "A $1");
    let tokens = gFixed
      .split(/\s+A\s+|\s+AO\s+/)
      .map((t) => t.trim())
      .filter((t) => t && t !== "A");

    if (tokens.length < 2) {
      const found = letters.filter((l) =>
        new RegExp(`\\b${escapeRegExp(l.label.toUpperCase())}\\b`).test(g)
      );
      if (found.length >= 2) {
        tokens = [found[0].label, found[found.length - 1].label];
      }
    }
    if (tokens.length < 2) return null;

    const start = tokens[0];
    const end = tokens[tokens.length - 1];
    if (!letterLabels.has(start) || !letterLabels.has(end)) return null;

    const i0 = letters.findIndex((l) => l.label.toUpperCase() === start);
    const i1 = letters.findIndex((l) => l.label.toUpperCase() === end);
    if (i0 === -1 || i1 === -1 || i0 > i1) return null;

    return letters.slice(i0, i1 + 1).map((l) => ({ label: l.label, code: l.code }));
  }

  // faixa numérica
  const nums = (g.match(/\d+/g) || []).map((n) => parseInt(n, 10));
  if (nums.length < 2) return null;
  let [start, end] = [nums[0], nums[nums.length - 1]];
  if (start > end) [start, end] = [end, start];

  const out: ParsedSize[] = [];
  for (let n = start; n <= end; n += numericStep) {
    out.push({ label: String(n), code: String(n).padStart(2, "0") });
  }
  return out;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
