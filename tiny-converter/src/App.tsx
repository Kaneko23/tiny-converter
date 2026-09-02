import { BrowserRouter, NavLink, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./supabase/AuthContext";
import { LoginGate } from "./components/LoginGate";
import { isSupabaseConfigured } from "./supabase/client";
import { ProductsPage } from "./pages/ProductsPage";
import { OrdersPage } from "./pages/OrdersPage";

function Shell() {
  const { configured, session, signOut } = useAuth();
  return (
    <div className="min-h-screen">
      <div className="h-1.5 bg-brand-600" />
      <header className="bg-ink text-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
          <div className="flex items-baseline gap-3">
            <span className="font-sans text-lg font-extrabold tracking-tight text-paper">LEI ATUAL</span>
            <span className="hidden text-xs font-medium uppercase tracking-[0.2em] text-white/40 sm:inline">
              Conversor Tiny
            </span>
          </div>
          <nav className="flex gap-1 text-xs font-semibold uppercase tracking-wider">
            <NavLink
              to="/produtos"
              className={({ isActive }) =>
                `rounded-full px-3.5 py-1.5 transition-colors ${
                  isActive ? "bg-paper text-ink" : "text-white/55 hover:text-white"
                }`
              }
            >
              Produtos
            </NavLink>
            <NavLink
              to="/pedidos"
              className={({ isActive }) =>
                `rounded-full px-3.5 py-1.5 transition-colors ${
                  isActive ? "bg-paper text-ink" : "text-white/55 hover:text-white"
                }`
              }
            >
              Pedidos
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-[11px] uppercase tracking-wide text-white/40">
            {!isSupabaseConfigured && (
              <span title="Sem Supabase configurado — nada é salvo entre sessões">modo local</span>
            )}
            {configured && session && (
              <button onClick={signOut} className="text-white/40 hover:text-white">
                sair ({session.user.email})
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/produtos" replace />} />
          <Route path="/produtos" element={<ProductsPage />} />
          <Route path="/pedidos" element={<OrdersPage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <LoginGate>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </LoginGate>
    </AuthProvider>
  );
}

export default App;
