import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { HomePage } from '../features/home/HomePage';
import { PdvPage } from '../features/pdv/PdvPage';
import { ConsultasPage } from '../features/consultas/ConsultasPage';
import { BilhetesPage } from '../features/bilhetes/BilhetesPage';
import { BilheteFormPage } from '../features/bilhetes/BilheteFormPage';
import { AdminPage } from '../features/admin/AdminPage';
import { UsuariosPage } from '../features/admin/UsuariosPage';
import { ConfiguracoesPage } from '../features/admin/ConfiguracoesPage';
import { MinhaContaPage } from '../features/conta/MinhaContaPage';
import { useAuthStore } from '../store/authStore';

// Guarda de Rota
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, restaurando } = useAuthStore();
  if (restaurando) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Guarda de Rota — somente admin
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, restaurando, usuario } = useAuthStore();
  if (restaurando) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (usuario?.papel !== 'ADMIN') return <Navigate to="/home" replace />;
  return <>{children}</>;
};

const PdvRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, restaurando, usuario } = useAuthStore();
  if (restaurando) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!usuario?.prontoParaVender) return <Navigate to="/minha-conta" replace />;
  return <>{children}</>;
};

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/home"
          element={
            <PrivateRoute>
              <HomePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/pdv"
          element={
            <PdvRoute>
              <PdvPage />
            </PdvRoute>
          }
        />
        <Route
          path="/consultas"
          element={
            <PrivateRoute>
              <ConsultasPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/bilhetes"
          element={
            <PrivateRoute>
              <BilhetesPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/bilhetes/novo"
          element={
            <PrivateRoute>
              <BilheteFormPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/bilhetes/:id"
          element={
            <PrivateRoute>
              <BilheteFormPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/minha-conta"
          element={
            <PrivateRoute>
              <MinhaContaPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <AdminRoute>
              <UsuariosPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/configuracoes"
          element={
            <AdminRoute>
              <ConfiguracoesPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
