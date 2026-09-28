import { ReactNode, useState } from 'react';
import { clsx } from 'clsx';
import { Menu, RefreshCw, WifiOff } from 'lucide-react';
import fortfruitLogo from '@/fortfruit-logo.png';
import { useAuthStore } from '../store/authStore';
import { useStatusConexao } from '../hooks/useStatusConexao';
import { useUltimaSincronizacao } from '../hooks/useUltimaSincronizacao';
import { Sidebar } from './Sidebar';

const CHAVE_COLAPSO = '@pdv:sidebarColapsada';

// Chrome global do app (barra fixa no topo + sidebar escura) — extraído da Home pra ser
// reaproveitado em qualquer tela "interna" (Home, Admin, Usuários...), assim todas seguem o
// mesmo visual em vez de cada uma ter seu próprio header solto.
interface AppShellProps {
  children: ReactNode;
  rotaAtiva: string;
  className?: string;
}

export function AppShell({ children, rotaAtiva, className }: AppShellProps) {
  const { vendedor, usuario } = useAuthStore();
  const online = useStatusConexao();
  const ultimaSincronizacao = useUltimaSincronizacao();
  // Mora aqui (não dentro do Sidebar) porque o espaçador abaixo precisa reservar exatamente a
  // mesma largura da sidebar fixa (w-60 expandida / w-16 recolhida) pra não sobrepor o conteúdo.
  const [colapsada, setColapsada] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_COLAPSO) === '1';
    } catch {
      return false;
    }
  });
  // A sidebar fixa só existe em telas grandes (lg:). Em telas menores (tablet em retrato, por
  // exemplo) ela nunca aparece, então esse drawer é o único jeito de navegar ali.
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  const formatadorHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const versao = import.meta.env.APP_VERSION as string | undefined;

  const alternarColapso = () => {
    setColapsada((atual) => {
      const novo = !atual;
      try {
        localStorage.setItem(CHAVE_COLAPSO, novo ? '1' : '0');
      } catch {
        // localStorage indisponível (modo privado, storage bloqueado) — só não persiste a preferência
      }
      return novo;
    });
  };

  return (
    <div className={clsx('min-h-screen bg-slate-100 font-sans text-slate-900', className)}>
      {/* TOPO FIXO */}
      <header className="fixed top-0 inset-x-0 h-16 bg-white border-b border-slate-200 z-30 flex items-center gap-3 px-6">
        <button
          onClick={() => setMenuMobileAberto(true)}
          className="lg:hidden shrink-0 p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          title="Menu"
        >
          <Menu size={22} />
        </button>
        <img src={fortfruitLogo} alt="Fort Fruit" className="h-10 w-auto object-contain shrink-0" />
      </header>

      {/* Telas pequenas (tablet em retrato, celular): a sidebar fixa acima não aparece, então o
          único jeito de navegar é este drawer, aberto pelo botão de menu no topo. */}
      <div className="lg:hidden">
        <Sidebar rotaAtiva={rotaAtiva} aberta={menuMobileAberto} aoFechar={() => setMenuMobileAberto(false)} />
      </div>

      {/* SIDEBAR fixa: sobreposição de tela cheia (sem clique fora da faixa central) só pra
          reaproveitar o mesmo max-w/centralização do conteúdo, mantendo o menu sempre alinhado
          com a coluna de conteúdo em qualquer largura de tela, sem o "pulo" que sticky causava
          ao chegar no fim do scroll. */}
      <div className="hidden lg:block fixed top-20 bottom-14 left-0 right-0 pointer-events-none z-20">
        <div className="max-w-[1600px] mx-auto h-full px-4">
          <Sidebar rotaAtiva={rotaAtiva} colapsada={colapsada} aoAlternarColapso={alternarColapso} />
        </div>
      </div>

      <div className="pt-20 pb-14 px-4">
        <div className="max-w-[1600px] mx-auto flex gap-4">
          {/* Espaço reservado pra sidebar fixa acima não sobrepor o conteúdo */}
          <div className={clsx('hidden lg:block shrink-0 transition-[width] duration-200', colapsada ? 'w-16' : 'w-60')} aria-hidden="true" />

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
