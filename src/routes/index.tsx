import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from '../features/home/HomePage';
import { PdvPage } from '../features/pdv/PdvPage';
import { ConsultasPage } from '../features/consultas/ConsultasPage';
import { BilhetesPage } from '../features/bilhetes/BilhetesPage';
import { BilheteFormPage } from '../features/bilhetes/BilheteFormPage';
import { useAuthStore } from '../store/authStore';

// Guarda de Rota
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route
          path="/pdv"
          element={
            <PrivateRoute>
              <PdvPage />
            </PrivateRoute>
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
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
