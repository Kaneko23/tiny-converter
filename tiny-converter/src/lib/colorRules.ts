import type { CodeTableEntry } from "./types";

/** Normaliza um código de cor para uma chave estável ("1", "01", " 1 " -> "1"). */
export function normalizeColorCode(code: string | number): string {
  return String(code).trim().replace(/^0+(?=\d)/, "");
}

export function colorTableToMap(table: CodeTableEntry[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const entry of table) {
    m.set(normalizeColorCode(entry.code), entry.name.trim());
  }
  return m;
}

export function lookupColorName(
  code: string | number | null | undefined,
  table: CodeTableEntry[]
): string | null {
  if (code === null || code === undefined) return null;
  const key = normalizeColorCode(code);
  if (key === "") return null;
  const map = colorTableToMap(table);
  return map.get(key) ?? null;
}

/**
 * Extrai uma lista de códigos de cor de um texto livre tipo "COR 1,2,3,4,5",
 * "COR1,2,3,4,5,", " COR 2,4,5,6". Usado no cadastro de produtos (planilha do
 * tipo Mostruário), onde a coluna de observações às vezes lista as cores
 * disponíveis para aquela referência.
 */
export function extractColorCodesFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const t = String(text).trim();
  if (!t) return [];
  const nums = t.match(/\d+/g);
  if (!nums) return [];
  // remove duplicados mantendo ordem crescente numérica
  const uniq = Array.from(new Set(nums.map((n) => parseInt(n, 10))));
  uniq.sort((a, b) => a - b);
  return uniq.map((n) => String(n));
}
