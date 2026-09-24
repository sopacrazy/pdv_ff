import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, Eye, EyeOff, Loader2, RefreshCw, ScanLine, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import fortfruitLogo from '@/fortfruit-logo.png';

const DESTAQUES = [
  { icone: ScanLine, texto: 'Vendas rápidas com leitura por código de barras' },
  { icone: RefreshCw, texto: 'Produtos e preços sincronizados com o Protheus' },
  { icone: ShieldCheck, texto: 'Acesso individual por usuário e permissão' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [loginInput, setLoginInput] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !senha) return;
    setErro(null);
    setCarregando(true);
    const resultado = await login(loginInput.trim(), senha);
    setCarregando(false);
    if (resultado.sucesso) {
      navigate('/home');
    } else {
      setErro(resultado.erro || 'Não foi possível entrar.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex">
        {/* PAINEL DE MARCA — mesmo escuro da sidebar, pra dar consistência com o resto do sistema */}
        <div className="hidden lg:flex flex-1 flex-col justify-center bg-slate-900 p-12">
          <img src={fortfruitLogo} alt="Fort Fruit" className="h-14 object-contain mb-10" />
          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            O sistema de vendas
            <br />
            da Fort Fruit
          </h1>
          <p className="text-slate-400 mb-10">
            Feito sob medida para o nosso time vender, conferir caixa e acompanhar o movimento — em um só lugar.
          </p>

          <div className="flex flex-col gap-4">
            {DESTAQUES.map(({ icone: Icone, texto }) => (
              <div key={texto} className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300">
                  <Icone size={18} />
                </div>
                <p className="text-sm font-medium text-slate-300">{texto}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FORMULÁRIO */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={entrar} className="w-full max-w-sm flex flex-col">
          <img src={fortfruitLogo} alt="Fort Fruit" className="h-10 object-contain mb-8 lg:hidden self-center" />

          <h2 className="text-2xl font-bold text-slate-800 mb-1">Bem-vindo de volta</h2>
          <p className="text-sm text-slate-400 mb-8">Entre com seu usuário para continuar</p>

          {erro && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2.5 mb-5">
              <AlertCircle size={16} className="shrink-0" />
              {erro}
            </div>
          )}

          <div className="mb-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Usuário</label>
            <input
              autoFocus
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              disabled={carregando}
              className="w-full mt-1.5 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all disabled:opacity-60"
              placeholder="Seu login"
              autoComplete="username"
            />
          </div>

          <div className="mb-6">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Senha</label>
            <div className="relative mt-1.5">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={carregando}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 pr-11 text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all disabled:opacity-60"
                placeholder="Sua senha"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando || !loginInput.trim() || !senha}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregando ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
