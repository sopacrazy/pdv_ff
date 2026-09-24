import { useNavigate } from 'react-router-dom';
import { Users, ShieldCheck } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuthStore } from '../../store/authStore';

export function AdminPage() {
  const navigate = useNavigate();
  const usuario = useAuthStore((s) => s.usuario);

  return (
    <AppShell rotaAtiva="/admin">
      <header className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-6 py-4 flex items-center gap-2">
        <ShieldCheck size={20} className="text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Painel Administrador</h1>
          <p className="text-sm text-slate-400">Logado como {usuario?.nome}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/admin/usuarios')}
          className="bg-white p-8 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-4 text-slate-500 h-56 border border-slate-200/80 hover:border-slate-300 transition-colors group"
        >
          <Users size={48} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
          <span className="text-xl font-bold text-slate-700">Usuários</span>
          <span className="text-slate-400 text-sm">Cadastro e acesso</span>
        </button>
      </div>
    </AppShell>
  );
}
