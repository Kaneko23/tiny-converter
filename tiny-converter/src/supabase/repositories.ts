import { supabase } from "./client";
import type { CodeTableEntry, ColumnMapping, SizeLetterEntry } from "../lib/types";
import type { ClientRecord } from "../lib/orderConverter";

// Todas as funções aqui devolvem silenciosamente [] / null quando o Supabase
// não está configurado — quem chama trata isso como "modo local, sem nuvem".

export interface MappingPreset {
  id: string;
  name: string;
  file_type: "produtos" | "pedidos";
  mapping: ColumnMapping;
  created_at: string;
}

export async function listMappingPresets(fileType: "produtos" | "pedidos") {
  if (!supabase) return [] as MappingPreset[];
  const { data, error } = await supabase
    .from("mapping_presets")
    .select("*")
    .eq("file_type", fileType)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MappingPreset[];
}

export async function saveMappingPreset(
  name: string,
  fileType: "produtos" | "pedidos",
  mapping: ColumnMapping
) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("mapping_presets")
    .insert({ name, file_type: fileType, mapping })
    .select()
    .single();
  if (error) throw error;
  return data as MappingPreset;
}

export interface NamedPalette<T> {
  id: string;
  name: string;
  entries: T[];
  created_at: string;
}

export async function listColorPalettes() {
  if (!supabase) return [] as NamedPalette<CodeTableEntry>[];
  const { data, error } = await supabase
    .from("color_palettes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as NamedPalette<CodeTableEntry>[];
}

export async function saveColorPalette(name: string, entries: CodeTableEntry[]) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("color_palettes")
    .insert({ name, entries })
    .select()
    .single();
  if (error) throw error;
  return data as NamedPalette<CodeTableEntry>;
}

export async function listSizePalettes() {
  if (!supabase) return [] as NamedPalette<SizeLetterEntry>[];
  const { data, error } = await supabase
    .from("size_palettes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as NamedPalette<SizeLetterEntry>[];
}

export async function saveSizePalette(name: string, entries: SizeLetterEntry[]) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("size_palettes")
    .insert({ name, entries })
    .select()
    .single();
  if (error) throw error;
  return data as NamedPalette<SizeLetterEntry>;
}

export async function listClients(): Promise<ClientRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("clients")
    .select(
      "nome_fantasia, razao_social, cnpj_ou_cpf, ie, endereco, cidade, bairro, uf, cep, email, telefone, contato"
    )
    .order("nome_fantasia", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    nomeFantasia: r.nome_fantasia,
    razaoSocial: r.razao_social ?? undefined,
    cnpjOuCpf: r.cnpj_ou_cpf ?? undefined,
    ie: r.ie ?? undefined,
    endereco: r.endereco ?? undefined,
    cidade: r.cidade ?? undefined,
    bairro: r.bairro ?? undefined,
    uf: r.uf ?? undefined,
    cep: r.cep ?? undefined,
    email: r.email ?? undefined,
    telefone: r.telefone ?? undefined,
    contato: r.contato ?? undefined,
  }));
}

/** Faz "upsert" de uma leva de clientes (por nome fantasia) — usado ao importar a aba Clientes. */
export async function upsertClients(
  rows: {
    nomeFantasia: string;
    razaoSocial?: string;
    cnpjOuCpf?: string;
    ie?: string;
    endereco?: string;
    cidade?: string;
    bairro?: string;
    uf?: string;
    cep?: string;
    email?: string;
    telefone?: string;
    contato?: string;
  }[]
) {
  if (!supabase) return 0;
  const payload = rows.map((r) => ({
    nome_fantasia: r.nomeFantasia,
    razao_social: r.razaoSocial ?? null,
    cnpj_ou_cpf: r.cnpjOuCpf ?? null,
    ie: r.ie ?? null,
    endereco: r.endereco ?? null,
    cidade: r.cidade ?? null,
    bairro: r.bairro ?? null,
    uf: r.uf ?? null,
    cep: r.cep ?? null,
    email: r.email ?? null,
    telefone: r.telefone ?? null,
    contato: r.contato ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { error, count } = await supabase
    .from("clients")
    .upsert(payload, { onConflict: "nome_fantasia", count: "exact" });
  if (error) throw error;
  return count ?? payload.length;
}

export async function saveProductCatalog(
  collection: string,
  rows: { sku: string; parentSku: string | null; descricao: string; preco: number | null }[]
) {
  if (!supabase) return 0;
  const payload = rows.map((r) => ({
    sku: r.sku,
    parent_sku: r.parentSku,
    descricao: r.descricao,
    preco: r.preco,
    collection,
  }));
  const { error, count } = await supabase.from("products").insert(payload, { count: "exact" });
  if (error) throw error;
  return count ?? payload.length;
}

export async function findProductPriceBySku(sku: string): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("products")
    .select("preco")
    .eq("sku", sku)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.preco ?? null;
}

export async function logConversion(
  fileType: "produtos" | "pedidos",
  fileName: string,
  rowCount: number,
  warningCount: number
) {
  if (!supabase) return;
  await supabase.from("conversion_logs").insert({
    file_type: fileType,
    file_name: fileName,
    row_count: rowCount,
    warning_count: warningCount,
  });
}
