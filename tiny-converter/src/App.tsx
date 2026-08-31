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
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <span className="font-semibold text-brand-700">Conversor Tiny — Lei Atual</span>
          <nav className="flex gap-4 text-sm">
            <NavLink
              to="/produtos"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 ${isActive ? "bg-brand-100 text-brand-700" : "text-gray-500 hover:bg-gray-100"}`
              }
            >
              Cadastro de Produtos
            </NavLink>
            <NavLink
              to="/pedidos"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 ${isActive ? "bg-brand-100 text-brand-700" : "text-gray-500 hover:bg-gray-100"}`
              }
            >
              Pedidos
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
            {!isSupabaseConfigured && <span title="Sem Supabase configurado — nada é salvo entre sessões">modo local</span>}
            {configured && session && (
              <button onClick={signOut} className="text-gray-400 hover:text-gray-600">
                sair ({session.user.email})
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
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
