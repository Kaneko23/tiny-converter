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
    return (
      <div className="flex h-screen items-center justify-center bg-ink text-sm uppercase tracking-widest text-white/50">
        Carregando…
      </div>
    );
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
    <div className="flex h-screen items-center justify-center bg-ink px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4 rounded-sm bg-card p-8">
        <div>
          <p className="font-sans text-base font-extrabold tracking-tight text-ink">LEI ATUAL</p>
          <h1 className="mt-3 font-display text-xl font-semibold text-ink">Conversor Tiny</h1>
          <p className="mt-1 text-sm text-muted">Entre com a conta da equipe para continuar.</p>
        </div>
        <input
          type="email"
          required
          placeholder="e-mail"
          className="w-full rounded-sm border border-line bg-card px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder="senha"
          className="w-full rounded-sm border border-line bg-card px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-brand-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-brand-600 py-2.5 text-xs font-semibold uppercase tracking-wide text-paper hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
