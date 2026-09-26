import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { LayoutDashboard, MonitorPlay, Search, Ticket, ShieldCheck, LogOut, RefreshCw, WifiOff, UserRound } from 'lucide-react';
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
  const versao = import.meta.env.APP_VERSION as string | undefined;

  const itensMenu = [
    { rotulo: 'Início', icone: LayoutDashboard, rota: '/home' },
    {
      rotulo: 'PDV',
      icone: MonitorPlay,
      rota: '/pdv',
      desativado: !usuario?.prontoParaVender,
      titulo: 'Configure e valide sua conta Protheus em Minha conta',
    },
    { rotulo: 'Consultas', icone: Search, rota: '/consultas' },
    { rotulo: 'Bilhete', icone: Ticket, rota: '/bilhetes', desativado: true },
    { rotulo: 'Minha conta', icone: UserRound, rota: '/minha-conta' },
    ...(usuario?.papel === 'ADMIN' ? [{ rotulo: 'Administrador', icone: ShieldCheck, rota: '/admin' }] : []),
  ];

  const handleSair = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={clsx('min-h-screen bg-slate-100 font-sans text-slate-900', className)}>
      {/* TOPO FIXO */}
      <header className="fixed top-0 inset-x-0 h-16 bg-white border-b border-slate-200 z-30 flex items-center px-6">
        <img src={fortfruitLogo} alt="Fort Fruit" className="h-10 w-auto object-contain shrink-0" />
      </header>

      {/* SIDEBAR fixa: sobreposição de tela cheia (sem clique fora da faixa central) só pra
          reaproveitar o mesmo max-w/centralização do conteúdo, mantendo o menu sempre alinhado
          com a coluna de conteúdo em qualquer largura de tela, sem o "pulo" que sticky causava
          ao chegar no fim do scroll. */}
      <div className="hidden lg:block fixed top-20 bottom-14 left-0 right-0 pointer-events-none z-20">
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
                      title={item.titulo || 'Em breve'}
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

      <div className="pt-20 pb-14 px-4">
        <div className="max-w-[1600px] mx-auto flex gap-4">
          {/* Espaço reservado pra sidebar fixa acima não sobrepor o conteúdo */}
          <div className="hidden lg:block w-60 shrink-0" aria-hidden="true" />

          <div className="flex-1 min-w-0 flex flex-col gap-4">{children}</div>
        </div>
      </div>

      {/* RODAPÉ FIXO: barra de status fina (operador + conexão/sincronização + versão), no mesmo
          acabamento visual do rodapé de atalhos do PDV. O indicador de conexão que antes ficava
          no header mora só aqui agora, pra não duplicar a mesma informação em dois lugares. */}
      <footer className="fixed bottom-0 inset-x-0 h-9 bg-white border-t border-slate-200 z-30 flex items-center justify-between px-4 text-xs text-slate-500">
        <span className="font-medium truncate">
          {vendedor?.nome || 'Operador'}
          <span className="text-slate-300 mx-1.5">·</span>
          {usuario?.papel === 'ADMIN' ? 'Administrador' : 'Operador'}
        </span>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={clsx('flex items-center gap-1.5 font-medium', online ? 'text-slate-500' : 'text-red-600')}
            title={
              ultimaSincronizacao
                ? `Última sincronização com o Protheus: ${ultimaSincronizacao.toLocaleString('pt-BR')}`
                : 'Ainda não sincronizou com o Protheus'
            }
          >
            {online ? <RefreshCw size={12} /> : <WifiOff size={12} />}
            {online
              ? ultimaSincronizacao
                ? `Sincronizado ${formatadorHora.format(ultimaSincronizacao)}`
                : 'Sem sincronização'
              : 'Offline'}
          </span>
          {versao && (
            <>
              <span className="text-slate-300">·</span>
              <span>PDV Fort Fruit v{versao}</span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
