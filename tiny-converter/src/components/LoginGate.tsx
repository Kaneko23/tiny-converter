import { useState, type ReactNode } from "react";
import { useAuth } from "../supabase/AuthContext";

/**
 * Se o Supabase não estiver configurado, deixa passar direto (modo local, sem login).
 * Se estiver configurado, exige login por e-mail/senha antes de mostrar a ferramenta.
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const { configured, session, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!configured) return <>{children}</>;
  if (loading) {
    return <div className="flex h-screen items-center justify-center text-gray-400">Carregando…</div>;
  }
  if (session) return <>{children}</>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await signIn(email, password);
    if (err) setError(err);
    setSubmitting(false);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-80 space-y-3 rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800">Conversor Tiny</h1>
        <p className="text-sm text-gray-500">Entre com a conta da equipe para continuar.</p>
        <input
          type="email"
          required
          placeholder="e-mail"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder="senha"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
