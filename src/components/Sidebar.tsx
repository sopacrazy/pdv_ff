import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { LayoutDashboard, MonitorPlay, Search, Ticket, ShieldCheck, LogOut, UserRound, ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const CHAVE_COLAPSO = '@pdv:sidebarColapsada';

interface SidebarProps {
  rotaAtiva: string;
  // Sem `aberta`, a sidebar fica sempre fixa e pode ser recolhida pra só ícones (AppShell, telas
  // desktop). Com `aberta`/`aoFechar`, vira um painel deslizante por cima do conteúdo — usado na
  // tela de Bilhete, que é full-screen e não reserva espaço fixo pra sidebar.
  aberta?: boolean;
  aoFechar?: () => void;
  // Controlado externamente pelo AppShell — ele reserva o espaço do conteúdo (w-60/w-16) na mesma
  // largura da sidebar fixa, então os dois precisam ler/escrever o mesmo estado. Sem esses props
  // (modo drawer), o componente cuida do próprio estado sozinho.
  colapsada?: boolean;
  aoAlternarColapso?: () => void;
}

export function Sidebar({ rotaAtiva, aberta, aoFechar, colapsada: colapsadaExterna, aoAlternarColapso }: SidebarProps) {
  const navigate = useNavigate();
  const { vendedor, usuario, logout } = useAuthStore();
  const [colapsadaInterna, setColapsadaInterna] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_COLAPSO) === '1';
    } catch {
      return false;
    }
  });
  const controlada = colapsadaExterna !== undefined;
  const colapsada = controlada ? colapsadaExterna : colapsadaInterna;
  const ehDrawer = aberta !== undefined;
  const expandida = ehDrawer || !colapsada;

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
    {
      rotulo: 'Bilhete',
      icone: Ticket,
      rota: '/bilhetes',
      desativado: !usuario?.prontoParaVender,
      titulo: 'Configure e valide sua conta Protheus em Minha conta',
    },
    { rotulo: 'Minha conta', icone: UserRound, rota: '/minha-conta' },
    ...(usuario?.papel === 'ADMIN' ? [{ rotulo: 'Administrador', icone: ShieldCheck, rota: '/admin' }] : []),
  ];

  const alternarColapso = () => {
    if (controlada) {
      aoAlternarColapso?.();
      return;
    }
    setColapsadaInterna((atual) => {
      const novo = !atual;
      try {
        localStorage.setItem(CHAVE_COLAPSO, novo ? '1' : '0');
      } catch {
        // localStorage indisponível (modo privado, storage bloqueado) — só não persiste a preferência
      }
      return novo;
    });
  };

  const irPara = (rota: string) => {
    navigate(rota);
    aoFechar?.();
  };

  const handleSair = async () => {
    await logout();
    navigate('/login');
  };

  const conteudo = (
    <aside
      className={clsx(
        'pointer-events-auto flex h-full flex-col bg-slate-900 shadow-sm p-3 transition-[width] duration-200',
        expandida ? 'w-60' : 'w-16',
        ehDrawer ? 'rounded-r-2xl' : 'rounded-2xl'
      )}
    >
      <div className="flex items-center justify-between mb-2 min-h-9">
        {ehDrawer ? (
          <>
            <span className="text-white font-bold text-sm px-2">Menu</span>
            <button onClick={aoFechar} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" title="Fechar menu">
              <X size={18} />
            </button>
          </>
        ) : (
          <button
            onClick={alternarColapso}
            className="ml-auto p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title={colapsada ? 'Expandir menu' : 'Recolher menu'}
          >
            {colapsada ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-1">
        {itensMenu.map((item) => {
          const ativo = item.rota === rotaAtiva;
          const Icone = item.icone;
          if (item.desativado) {
            return (
              <div
                key={item.rota}
                title={item.titulo || 'Em breve'}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm text-slate-600 opacity-50 cursor-not-allowed',
                  !expandida && 'justify-center'
                )}
              >
                <Icone size={18} />
                {expandida && item.rotulo}
              </div>
            );
          }
          return (
            <button
              key={item.rota}
              onClick={() => irPara(item.rota)}
              title={!expandida ? item.rotulo : undefined}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors',
                !expandida && 'justify-center',
                ativo ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              )}
            >
              <Icone size={18} />
              {expandida && item.rotulo}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className={clsx('border-t border-slate-800 pt-3 flex items-center gap-2', !expandida && 'justify-center')}>
        {expandida && (
          <>
            <div className="h-9 w-9 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-sm shrink-0">
              {(vendedor?.nome || 'Operador').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{vendedor?.nome || 'Operador'}</p>
              <p className="text-xs text-slate-400 truncate">{usuario?.papel === 'ADMIN' ? 'Administrador' : 'Operador'}</p>
            </div>
          </>
        )}
        <button
          onClick={handleSair}
          title="Sair"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );

  if (!ehDrawer) return conteudo;

  return (
    <div className={clsx('fixed inset-0 z-[200]', aberta ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!aberta}>
      <div
        className={clsx('absolute inset-0 bg-slate-950/50 transition-opacity duration-200', aberta ? 'opacity-100' : 'opacity-0')}
        onClick={aoFechar}
      />
      <div className={clsx('absolute inset-y-0 left-0 transition-transform duration-200', aberta ? 'translate-x-0' : '-translate-x-full')}>
        {conteudo}
      </div>
    </div>
  );
}
