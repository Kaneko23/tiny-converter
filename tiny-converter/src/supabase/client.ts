import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Se as variáveis de ambiente não estiverem configuradas, a ferramenta continua
// funcionando 100% no navegador (sem salvar nada) — só perde os recursos de
// "lembrar" mapeamentos, clientes e catálogo entre sessões/usuários.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;
