import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePdvStore } from '../../store/pdvStore';
import { MonitorPlay, Wallet, Lock, Search, LogOut, Clock, User, Store } from 'lucide-react';

export function HomePage() {
  const navigate = useNavigate();
  const { vendedor, loja, caixa, logout } = useAuthStore();
  const { isCaixaAberto, fecharCaixa } = usePdvStore();
  const [horaAtual, setHoraAtual] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatadorData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' });
  const formatadorHora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' });

  const handleSair = () => {
    logout();
    navigate('/login');
  };

  const handleFechamento = () => {
    if(confirm('Deseja realmente fechar o caixa?')) {
      fecharCaixa();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white p-4 shadow-sm flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <User size={18} className="text-blue-600" />
            <span className="font-semibold uppercase">{vendedor?.nome || 'OPERADOR PADRÃO'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Store size={18} className="text-blue-600" />
            <span className="text-slate-600">Loja: <strong className="text-slate-900">{loja}</strong> | Caixa: <strong className="text-slate-900">{caixa}</strong></span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-slate-500">
            <Clock size={18} />
            <span className="capitalize">{formatadorData.format(horaAtual)} - {formatadorHora.format(horaAtual)}</span>
          </div>
          <button 
            onClick={handleSair}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 flex flex-col max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Painel de Controle</h1>
            <p className="text-slate-500 mt-1">Selecione uma operação para iniciar</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">Status do Caixa:</span>
            {isCaixaAberto ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">ABERTO</span>
            ) : (
              <span className="px-3 py-1 bg-slate-200 text-slate-600 text-sm font-bold rounded-full">FECHADO</span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card PDV - Active */}
          <button 
            onClick={() => navigate('/pdv')}
            className="bg-blue-600 hover:bg-blue-700 transition-colors p-8 rounded-2xl shadow-md flex flex-col items-center justify-center gap-4 text-white group h-64 border border-blue-500"
          >
            <div className="p-4 bg-white/20 rounded-full group-hover:scale-110 transition-transform">
              <MonitorPlay size={48} />
            </div>
            <span className="text-xl font-bold">{isCaixaAberto ? 'Ir para PDV' : 'Abrir Caixa'}</span>
            <span className="text-blue-100 text-sm">{isCaixaAberto ? 'Continuar vendas' : 'Iniciar operação'}</span>
          </button>

          {/* Cards */}
          <div className="bg-white p-8 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-4 text-slate-500 h-64 border border-slate-200 relative overflow-hidden group hover:border-slate-300 transition-colors cursor-pointer">
            <div className="absolute top-4 right-4 text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">
              Em breve
            </div>
            <Wallet size={48} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
            <span className="text-xl font-bold text-slate-700">Sangria</span>
            <span className="text-slate-400 text-sm">Retirada de valor</span>
          </div>

          <button 
            onClick={handleFechamento}
            disabled={!isCaixaAberto}
            className="bg-white p-8 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-4 text-slate-500 h-64 border border-slate-200 relative overflow-hidden hover:border-slate-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            <Lock size={48} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
            <span className="text-xl font-bold text-slate-700">Fechamento</span>
            <span className="text-slate-400 text-sm">Encerrar caixa</span>
          </button>

          <div className="bg-white p-8 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-4 text-slate-500 h-64 border border-slate-200 relative overflow-hidden group hover:border-slate-300 transition-colors cursor-pointer">
            <div className="absolute top-4 right-4 text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">
              Em breve
            </div>
            <Search size={48} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
            <span className="text-xl font-bold text-slate-700">Consultas</span>
            <span className="text-slate-400 text-sm">Estoque e preços</span>
          </div>
        </div>
      </main>
    </div>
  );
}
