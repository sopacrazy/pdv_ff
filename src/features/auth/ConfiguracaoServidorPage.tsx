import { useState } from 'react';
import { ServerCog, Loader2, AlertCircle, Wifi } from 'lucide-react';
import { definirApiBaseUrl, obterApiBaseUrl } from '../../services/apiBase';
import fortfruitLogo from '@/fortfruit-logo.png';

// Só existe dentro do app Android (ver src/services/apiBase.ts) — o tablet não tem servidor
// próprio, ele fala com o PC do caixa pela rede local, então precisa saber o IP dele antes de
// mostrar login ou qualquer outra tela.
export function ConfiguracaoServidorPage({ aoConfigurar }: { aoConfigurar: () => void }) {
  const [endereco, setEndereco] = useState(obterApiBaseUrl().replace(/^https?:\/\//, ''));
  const [testando, setTestando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const testarEsalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const semBarra = endereco.trim().replace(/\/+$/, '');
    if (!semBarra) return;
    const url = /^https?:\/\//.test(semBarra) ? semBarra : `http://${semBarra}`;

    setTestando(true);
    setErro(null);
    try {
      const resp = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) throw new Error();
      definirApiBaseUrl(url);
      aoConfigurar();
    } catch {
      setErro('Não foi possível conectar nesse endereço. Confira o IP e se o PDV está aberto no PC do caixa.');
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
        <img src={fortfruitLogo} alt="Fort Fruit" className="h-10 object-contain mb-6 mx-auto" />

        <div className="flex items-center gap-2 mb-1">
          <ServerCog size={20} className="text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Conectar ao PDV</h1>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          Informe o IP do computador do caixa (o mesmo onde o PDV Fort Fruit está aberto), na mesma rede Wi-Fi deste
          tablet.
        </p>

        {erro && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2.5 mb-5">
            <AlertCircle size={16} className="shrink-0" />
            {erro}
          </div>
        )}

        <form onSubmit={testarEsalvar} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Endereço do servidor</label>
            <div className="relative mt-1.5">
              <Wifi size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                disabled={testando}
                placeholder="192.168.1.50:3001"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all disabled:opacity-60"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={testando || !endereco.trim()}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testando ? <Loader2 size={18} className="animate-spin" /> : <ServerCog size={18} />}
            {testando ? 'Conectando...' : 'Conectar'}
          </button>
        </form>
      </div>
    </div>
  );
}
