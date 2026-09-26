import { useEffect, useState } from 'react';
import { ArrowLeft, Building2, MonitorCog, Save, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { Toast } from '../../components/Toast';
import { configuracaoService } from '../../services/configuracaoService';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';

const FILIAIS = [
  { codigo: '01', nome: 'Belém', habilitada: true },
  { codigo: '04', nome: 'Castanhal', habilitada: false },
  { codigo: '06', nome: 'Piedade', habilitada: false },
];

const CAIXAS = ['001', '002', '003', '004'];

export function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { token, loja, caixa, definirConfiguracao } = useAuthStore();
  const { mostrarToast } = useToastStore();
  const [filialSelecionada, setFilialSelecionada] = useState(loja);
  const [caixaSelecionado, setCaixaSelecionado] = useState(caixa);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!token) return;
    configuracaoService.buscar(token).then((configuracao) => {
      if (configuracao) {
        setFilialSelecionada(configuracao.filial);
        setCaixaSelecionado(configuracao.caixa);
      } else {
        mostrarToast('Não foi possível carregar a configuração do sistema.', 'erro');
      }
      setCarregando(false);
    });
  }, [token, mostrarToast]);

  const salvar = async () => {
    if (!token) return;
    setSalvando(true);
    const resultado = await configuracaoService.salvar(token, {
      filial: filialSelecionada,
      caixa: caixaSelecionado,
    });
    setSalvando(false);

    if (!resultado.sucesso || !resultado.configuracao) {
      mostrarToast(resultado.erro || 'Não foi possível salvar a configuração.', 'erro');
      return;
    }

    definirConfiguracao(resultado.configuracao.filial, resultado.configuracao.caixa);
    mostrarToast('Configuração salva. As próximas vendas usarão a nova identificação.', 'sucesso');
  };

  return (
    <AppShell rotaAtiva="/admin">
      <Toast />

      <header className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/admin')}
          title="Voltar"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <Settings size={22} className="text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Configuração do Sistema</h1>
          <p className="text-sm text-slate-400">Identificação desta instalação do PDV</p>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <MonitorCog size={19} className="text-blue-600" />
            Operação do caixa
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Estes dados ficam gravados no banco local e identificam todas as novas vendas deste computador.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Building2 size={14} /> Filial / Loja
            </label>
            <select
              value={filialSelecionada}
              onChange={(e) => setFilialSelecionada(e.target.value)}
              disabled={carregando}
              className="w-full mt-2 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 disabled:opacity-60"
            >
              {FILIAIS.map((filial) => (
                <option key={filial.codigo} value={filial.codigo} disabled={!filial.habilitada}>
                  {filial.codigo} — {filial.nome}{filial.habilitada ? '' : ' (em breve)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-2">
              Castanhal e Piedade serão liberadas depois dos ajustes específicos de cada filial.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Caixa</label>
            <select
              value={caixaSelecionado}
              onChange={(e) => setCaixaSelecionado(e.target.value)}
              disabled={carregando}
              className="w-full mt-2 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 disabled:opacity-60"
            >
              {CAIXAS.map((numero) => (
                <option key={numero} value={numero}>Caixa {numero}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-2">
              O número escolhido será salvo no campo Caixa das próximas vendas e aparecerá no comprovante.
            </p>
          </div>
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={salvar}
            disabled={carregando || salvando}
            className="min-w-48 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {salvando ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </section>
    </AppShell>
  );
}
