import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { LayoutDashboard, MonitorPlay, Search, Ticket, ShieldCheck, LogOut, RefreshCw, WifiOff } from 'lucide-react';
import fortfruitLogo from '@/fortfruit-logo.png';
import { useAuthStore } from '../store/authStore';
import { useStatusConexao } from '../hooks/useStatusConexao';
import { useUltimaSincronizacao } from '../hooks/useUltimaSincronizacao';

// Chrome global do app (barra fixa no topo + sidebar escura) — extraído da Home pra ser
// reaproveitado em qualquer tela "interna" (Home, Admin, Usuários...), assim todas seguem o
// mesmo visual em vez de cada uma ter seu próprio header solto.
interface AppShellProps {
  children: ReactNode;
  rotaAtiva: string;
  className?: string;
}

export function AppShell({ children, rotaAtiva, className }: AppShellProps) {
  const navigate = useNavigate();
  const { vendedor, usuario, logout } = useAuthStore();
  const online = useStatusConexao();
  const ultimaSincronizacao = useUltimaSincronizacao();

  const formatadorHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const itensMenu = [
    { rotulo: 'Início', icone: LayoutDashboard, rota: '/home' },
    { rotulo: 'PDV', icone: MonitorPlay, rota: '/pdv' },
    { rotulo: 'Consultas', icone: Search, rota: '/consultas' },
    { rotulo: 'Bilhete', icone: Ticket, rota: '/bilhetes', desativado: true },
    ...(usuario?.papel === 'ADMIN' ? [{ rotulo: 'Administrador', icone: ShieldCheck, rota: '/admin' }] : []),
  ];

  const handleSair = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={clsx('min-h-screen bg-slate-100 font-sans text-slate-900', className)}>
      {/* TOPO FIXO */}
      <header className="fixed top-0 inset-x-0 h-16 bg-white border-b border-slate-200 z-30 flex items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src={fortfruitLogo} alt="Fort Fruit" className="h-10 w-auto object-contain shrink-0" />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div
            className={clsx(
              'hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold',
              online ? 'bg-slate-50 text-slate-500' : 'bg-red-50 text-red-600'
            )}
            title={
              ultimaSincronizacao
                ? `Última sincronização com o Protheus: ${ultimaSincronizacao.toLocaleString('pt-BR')}`
                : 'Ainda não sincronizou com o Protheus'
            }
          >
            {online ? <RefreshCw size={14} /> : <WifiOff size={14} />}
            {online
              ? ultimaSincronizacao
                ? `Sincronizado ${formatadorHora.format(ultimaSincronizacao)}`
                : 'Sem sincronização'
              : 'Offline'}
          </div>
        </div>
      </header>

      {/* SIDEBAR fixa: sobreposição de tela cheia (sem clique fora da faixa central) só pra
          reaproveitar o mesmo max-w/centralização do conteúdo, mantendo o menu sempre alinhado
          com a coluna de conteúdo em qualquer largura de tela, sem o "pulo" que sticky causava
          ao chegar no fim do scroll. */}
      <div className="hidden lg:block fixed top-20 bottom-4 left-0 right-0 pointer-events-none z-20">
        <div className="max-w-[1600px] mx-auto h-full px-4">
          <aside className="pointer-events-auto flex w-60 h-full flex-col bg-slate-900 rounded-2xl shadow-sm p-3">
            <nav className="flex flex-col gap-1">
              {itensMenu.map((item) => {
                const ativo = item.rota === rotaAtiva;
                const Icone = item.icone;
                if (item.desativado) {
                  return (
                    <div
                      key={item.rota}
                      title="Em breve"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm text-slate-600 opacity-50 cursor-not-allowed"
                    >
                      <Icone size={18} />
                      {item.rotulo}
                    </div>
                  );
                }
                return (
                  <button
                    key={item.rota}
                    onClick={() => navigate(item.rota)}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors',
                      ativo ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    )}
                  >
                    <Icone size={18} />
                    {item.rotulo}
                  </button>
                );
              })}
            </nav>

            <div className="flex-1" />

            <div className="border-t border-slate-800 pt-3 flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-sm shrink-0">
                {(vendedor?.nome || 'Operador').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{vendedor?.nome || 'Operador'}</p>
                <p className="text-xs text-slate-400 truncate">{usuario?.papel === 'ADMIN' ? 'Administrador' : 'Operador'}</p>
              </div>
              <button
                onClick={handleSair}
                title="Sair"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              >
                <LogOut size={16} />
              </button>
            </div>
          </aside>
        </div>
      </div>

      <div className="pt-20 p-4">
        <div className="max-w-[1600px] mx-auto flex gap-4">
          {/* Espaço reservado pra sidebar fixa acima não sobrepor o conteúdo */}
          <div className="hidden lg:block w-60 shrink-0" aria-hidden="true" />

          <div className="flex-1 min-w-0 flex flex-col gap-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
