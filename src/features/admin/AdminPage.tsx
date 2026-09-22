import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export function AdminPage() {
  const navigate = useNavigate();
  const usuario = useAuthStore((s) => s.usuario);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <header className="bg-white p-4 shadow-sm flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/home')}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-slate-800">Painel Administrador</h1>
              <p className="text-sm text-slate-400">Logado como {usuario?.nome}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <button
            onClick={() => navigate('/admin/usuarios')}
            className="bg-white p-8 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-4 text-slate-500 h-56 border border-slate-200 hover:border-slate-300 transition-colors group"
          >
            <Users size={48} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
            <span className="text-xl font-bold text-slate-700">Usuários</span>
            <span className="text-slate-400 text-sm">Cadastro e acesso</span>
          </button>
        </div>
      </main>
    </div>
  );
}
