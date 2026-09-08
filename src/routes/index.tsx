import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from '../features/home/HomePage';
import { PdvPage } from '../features/pdv/PdvPage';
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
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
