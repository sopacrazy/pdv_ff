import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowLeft, Plus, X, ShieldCheck, User as UserIcon, Power, Trash2 } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { usuarioService } from '../../services/usuarioService';
import { Usuario, Papel, UsuarioProtheus, VendedorProtheus } from '../../types/usuario';
import { Toast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';

const inputCls =
  'w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all';

interface FormularioUsuario {
  nome: string;
  login: string;
  senha: string;
  papel: Papel;
  protheusCodigo: string;
  protheusNome: string;
  protheusSenha: string;
  protheusVendFilial: string;
  protheusVendCodigo: string;
  protheusVendNome: string;
}

const FORM_VAZIO: FormularioUsuario = {
  nome: '',
  login: '',
  senha: '',
  papel: 'OPERADOR',
  protheusCodigo: '',
  protheusNome: '',
  protheusSenha: '',
  protheusVendFilial: '',
  protheusVendCodigo: '',
  protheusVendNome: '',
};

export function UsuariosPage() {
  const navigate = useNavigate();
  const { token, usuario: usuarioLogado } = useAuthStore();
  const { mostrarToast } = useToastStore();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState<'CRIAR' | 'EDITAR' | null>(null);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<Usuario | null>(null);
  const [form, setForm] = useState<FormularioUsuario>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [consultandoVinculo, setConsultandoVinculo] = useState(false);
  const [usuarioParaAlternar, setUsuarioParaAlternar] = useState<Usuario | null>(null);
  const [usuarioParaExcluir, setUsuarioParaExcluir] = useState<Usuario | null>(null);
  const [usuariosProtheus, setUsuariosProtheus] = useState<UsuarioProtheus[]>([]);
  const [carregandoProtheus, setCarregandoProtheus] = useState(false);
  const [erroProtheus, setErroProtheus] = useState(false);
  const [buscaProtheus, setBuscaProtheus] = useState('');
  const [protheusAberto, setProtheusAberto] = useState(false);
  const [protheusIndex, setProtheusIndex] = useState(0);
  const listaProtheusRef = useRef<HTMLDivElement>(null);

  const termoProtheus = buscaProtheus.trim().toLowerCase();
  const sugestoesProtheus = usuariosProtheus
    .filter(
      (u) =>
        termoProtheus.length === 0 ||
        u.nome.toLowerCase().includes(termoProtheus) ||
        u.codigo.toLowerCase().includes(termoProtheus)
    )
    .slice(0, 40);

  useEffect(() => {
    setProtheusIndex(0);
  }, [buscaProtheus]);

  useEffect(() => {
    const el = listaProtheusRef.current?.children[protheusIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [protheusIndex]);

  const [filiais, setFiliais] = useState<string[]>([]);
  const [vendedoresPorFilial, setVendedoresPorFilial] = useState<Record<string, VendedorProtheus[]>>({});
  const [carregandoVendedores, setCarregandoVendedores] = useState(false);
  const [erroVendedores, setErroVendedores] = useState(false);
  const [buscaVendedor, setBuscaVendedor] = useState('');
  const [vendedorAberto, setVendedorAberto] = useState(false);
  const [vendedorIndex, setVendedorIndex] = useState(0);
  const listaVendedorRef = useRef<HTMLDivElement>(null);

  // USR_CODIGO é o login do Basic Auth, mas A3_CODUSR aponta para o USR_ID interno. RFATA03
  // procura a SA3 por esse ID; por isso a lista só mostra o vínculo real do Protheus.
  const idUsuarioProtheusSelecionado = usuariosProtheus.find((u) => u.codigo === form.protheusCodigo)?.idProtheus;
  const vendedoresDisponiveis = form.protheusVendFilial && form.protheusCodigo
    ? (vendedoresPorFilial[form.protheusVendFilial] || []).filter((v) => v.usuarioCodigo === idUsuarioProtheusSelecionado)
    : [];
  const termoVendedor = buscaVendedor.trim().toLowerCase();
  const sugestoesVendedor = vendedoresDisponiveis
    .filter(
      (v) =>
        termoVendedor.length === 0 ||
        v.nome.toLowerCase().includes(termoVendedor) ||
        v.codigo.toLowerCase().includes(termoVendedor)
    )
    .slice(0, 40);

  useEffect(() => {
    setVendedorIndex(0);
  }, [buscaVendedor]);

  useEffect(() => {
    const el = listaVendedorRef.current?.children[vendedorIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [vendedorIndex]);

  const carregar = async () => {
    if (!token) return;
    setCarregando(true);
    setUsuarios(await usuarioService.listar(token));
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
  }, [token]);

  const carregarProtheus = async () => {
    if (!token || usuariosProtheus.length > 0) return;
    setCarregandoProtheus(true);
    setErroProtheus(false);
    const lista = await usuarioService.listarProtheus(token);
    setCarregandoProtheus(false);
    if (lista.length === 0) {
      setErroProtheus(true);
      return;
    }
    setUsuariosProtheus(lista);
  };

  const carregarFiliais = async () => {
    if (!token || filiais.length > 0) return;
    const lista = await usuarioService.listarFiliais(token);
    setFiliais(lista);
  };

  const carregarVendedores = async (filial: string) => {
    if (!token || !filial || vendedoresPorFilial[filial]) return;
    setCarregandoVendedores(true);
    setErroVendedores(false);
    const lista = await usuarioService.listarVendedores(token, filial);
    setCarregandoVendedores(false);
    if (lista.length === 0) {
      setErroVendedores(true);
      return;
    }
    setVendedoresPorFilial((prev) => ({ ...prev, [filial]: lista }));
  };

  const abrirCriacao = () => {
    setForm(FORM_VAZIO);
    setBuscaProtheus('');
    setBuscaVendedor('');
    setUsuarioEmEdicao(null);
    setModal('CRIAR');
    carregarProtheus();
    carregarFiliais();
  };

  const abrirEdicao = (usuario: Usuario) => {
    setForm({
      nome: usuario.nome,
      login: usuario.login,
      senha: '',
      papel: usuario.papel,
      protheusCodigo: usuario.protheusCodigo || '',
      protheusNome: usuario.protheusNome || '',
      protheusSenha: '',
      protheusVendFilial: usuario.protheusVendFilial || '',
      protheusVendCodigo: usuario.protheusVendCodigo || '',
      protheusVendNome: usuario.protheusVendNome || '',
    });
    setBuscaProtheus(usuario.protheusNome ? `${usuario.protheusNome} (${usuario.protheusCodigo})` : '');
    setBuscaVendedor(usuario.protheusVendNome ? `${usuario.protheusVendNome} (${usuario.protheusVendCodigo})` : '');
    setUsuarioEmEdicao(usuario);
    setModal('EDITAR');
    carregarProtheus();
    carregarFiliais();
    if (usuario.protheusVendFilial) carregarVendedores(usuario.protheusVendFilial);
  };

  const selecionarFilial = (filial: string) => {
    setForm((f) => ({ ...f, protheusVendFilial: filial, protheusVendCodigo: '', protheusVendNome: '' }));
    setBuscaVendedor('');
    if (filial) carregarVendedores(filial);
  };

  const selecionarVendedor = (v: VendedorProtheus) => {
    setForm((f) => ({ ...f, protheusVendCodigo: v.codigo, protheusVendNome: v.nome }));
    setBuscaVendedor(`${v.nome} (${v.codigo})`);
    setVendedorAberto(false);
  };

  const limparVendedor = () => {
    setForm((f) => ({ ...f, protheusVendCodigo: '', protheusVendNome: '' }));
    setBuscaVendedor('');
  };

  const handleVendedorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!vendedorAberto) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setVendedorIndex((i) => Math.min(i + 1, sugestoesVendedor.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setVendedorIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sugestoesVendedor[vendedorIndex]) selecionarVendedor(sugestoesVendedor[vendedorIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setVendedorAberto(false);
    }
  };

  const selecionarProtheus = (u: UsuarioProtheus) => {
    setForm((f) => ({
      ...f,
      protheusCodigo: u.codigo,
      protheusNome: u.nome,
      protheusVendCodigo: '',
      protheusVendNome: '',
    }));
    setBuscaProtheus(`${u.nome} (${u.codigo})`);
    setBuscaVendedor('');
    setProtheusAberto(false);
  };

  const limparProtheus = () => {
    setForm((f) => ({ ...f, protheusCodigo: '', protheusNome: '', protheusVendCodigo: '', protheusVendNome: '' }));
    setBuscaProtheus('');
    setBuscaVendedor('');
  };

  const consultarVinculoProtheus = async () => {
    if (!token || !form.protheusCodigo) {
      mostrarToast('Selecione primeiro o usuário Protheus', 'erro');
      return;
    }
    if (!form.protheusSenha && !(modal === 'EDITAR' && usuarioEmEdicao?.protheusSenhaDefinida)) {
      mostrarToast('Informe a senha REST do usuário Protheus', 'erro');
      return;
    }
    setConsultandoVinculo(true);
    const resultado = await usuarioService.consultarVendedorDoUsuario(token, {
      protheusCodigo: form.protheusCodigo,
      protheusSenha: form.protheusSenha || undefined,
      usuarioPdvId: usuarioEmEdicao?.id,
    });
    setConsultandoVinculo(false);
    if (!resultado.sucesso || !resultado.vendedor) {
      mostrarToast(resultado.erro || 'Vendedor não encontrado no Protheus', 'erro');
      return;
    }
    const vendedor = resultado.vendedor;
    setForm((atual) => ({
      ...atual,
      protheusVendFilial: vendedor.filial,
      protheusVendCodigo: vendedor.codigo,
      protheusVendNome: vendedor.nome,
    }));
    setBuscaVendedor(`${vendedor.nome} (${vendedor.codigo})`);
    mostrarToast(`Vínculo confirmado: ${vendedor.codigo} — ${vendedor.nome}`, 'sucesso');
    carregarVendedores(vendedor.filial);
  };

  const handleProtheusKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!protheusAberto) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setProtheusIndex((i) => Math.min(i + 1, sugestoesProtheus.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setProtheusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sugestoesProtheus[protheusIndex]) selecionarProtheus(sugestoesProtheus[protheusIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setProtheusAberto(false);
    }
  };

  const salvar = async () => {
    if (!token) return;
    if (!form.nome.trim() || (modal === 'CRIAR' && !form.login.trim())) {
      mostrarToast('Preencha nome e login', 'erro');
      return;
    }
    if (modal === 'CRIAR' && form.senha.length < 6) {
      mostrarToast('A senha precisa ter pelo menos 6 caracteres', 'erro');
      return;
    }
    if (modal === 'EDITAR' && form.senha && form.senha.length < 6) {
      mostrarToast('A senha precisa ter pelo menos 6 caracteres', 'erro');
      return;
    }
    const temVinculoParcial = !!(form.protheusCodigo || form.protheusVendFilial || form.protheusVendCodigo || form.protheusSenha);
    if (temVinculoParcial && (!form.protheusCodigo || !form.protheusVendFilial || !form.protheusVendCodigo)) {
      mostrarToast('Selecione usuário Protheus, filial e o vendedor vinculado', 'erro');
      return;
    }
    setSalvando(true);
    const resultado =
      modal === 'CRIAR'
        ? await usuarioService.criar(token, {
            nome: form.nome,
            login: form.login,
            senha: form.senha,
            papel: form.papel,
            protheusCodigo: form.protheusCodigo || null,
            protheusNome: form.protheusNome || null,
            protheusSenha: form.protheusSenha || undefined,
            protheusVendFilial: form.protheusVendFilial || null,
            protheusVendCodigo: form.protheusVendCodigo || null,
            protheusVendNome: form.protheusVendNome || null,
          })
        : await usuarioService.atualizar(token, usuarioEmEdicao!.id, {
            nome: form.nome,
            papel: form.papel,
            senha: form.senha || undefined,
            protheusCodigo: form.protheusCodigo || null,
            protheusNome: form.protheusNome || null,
            protheusSenha: form.protheusSenha || undefined,
            protheusVendFilial: form.protheusVendFilial || null,
            protheusVendCodigo: form.protheusVendCodigo || null,
            protheusVendNome: form.protheusVendNome || null,
          });
    setSalvando(false);

    if (resultado.sucesso) {
      mostrarToast(modal === 'CRIAR' ? 'Usuário criado' : 'Usuário atualizado', 'sucesso');
      setModal(null);
      carregar();
    } else {
      mostrarToast(resultado.erro || 'Falha ao salvar usuário', 'erro');
    }
  };

  const confirmarAlternarStatus = async () => {
    if (!token || !usuarioParaAlternar) return;
    const resultado = await usuarioService.atualizar(token, usuarioParaAlternar.id, {
      ativo: !usuarioParaAlternar.ativo,
    });
    setUsuarioParaAlternar(null);
    if (resultado.sucesso) {
      mostrarToast(usuarioParaAlternar.ativo ? 'Usuário desativado' : 'Usuário reativado', 'sucesso');
      carregar();
    } else {
      mostrarToast(resultado.erro || 'Falha ao atualizar usuário', 'erro');
    }
  };

  const confirmarExclusao = async () => {
    if (!token || !usuarioParaExcluir) return;
    const resultado = await usuarioService.excluir(token, usuarioParaExcluir.id);
    setUsuarioParaExcluir(null);
    if (resultado.sucesso) {
      mostrarToast('Usuário excluído', 'sucesso');
      carregar();
    } else {
      mostrarToast(resultado.erro || 'Falha ao excluir usuário', 'erro');
    }
  };

  return (
    <AppShell rotaAtiva="/admin">
      <Toast />
      <header className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Usuários</h1>
            <p className="text-sm text-slate-400">Quem pode acessar o PDV</p>
          </div>
        </div>
        <button
          onClick={abrirCriacao}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
        >
          <Plus size={18} />
          Novo Usuário
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        {carregando ? (
            <div className="p-16 text-center text-slate-400">Carregando...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">Nome</th>
                  <th className="p-4">Login</th>
                  <th className="p-4">Protheus</th>
                  <th className="p-4">Vendedor</th>
                  <th className="p-4">Papel</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="p-4 font-bold text-slate-800">{u.nome}</td>
                    <td className="p-4 text-slate-500 font-mono text-sm">{u.login}</td>
                    <td className="p-4 text-slate-500 text-sm">
                      {u.protheusNome ? (
                        <span>
                          {u.protheusNome} <span className="text-slate-400 font-mono text-xs">({u.protheusCodigo})</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 text-sm">
                      {u.protheusVendNome ? (
                        <div className="flex flex-col items-start gap-1">
                          <span>
                            {u.protheusVendNome}{' '}
                            <span className="text-slate-400 font-mono text-xs">
                              (Fil. {u.protheusVendFilial} / {u.protheusVendCodigo})
                            </span>
                          </span>
                          <span className={clsx(
                            'text-[10px] uppercase font-bold px-2 py-0.5 rounded-full',
                            u.prontoParaVender
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          )}>
                            {u.prontoParaVender ? 'Pronto para vender' : 'Configuração pendente'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold',
                          u.papel === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {u.papel === 'ADMIN' ? <ShieldCheck size={12} /> : <UserIcon size={12} />}
                        {u.papel === 'ADMIN' ? 'Admin' : 'Operador'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={clsx(
                          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold',
                          u.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        )}
                      >
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => abrirEdicao(u)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 px-2 py-1 transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setUsuarioParaAlternar(u)}
                          disabled={u.id === usuarioLogado?.id}
                          title={u.id === usuarioLogado?.id ? 'Você não pode desativar seu próprio usuário' : ''}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                        >
                          <Power size={16} />
                        </button>
                        <button
                          onClick={() => setUsuarioParaExcluir(u)}
                          disabled={u.id === usuarioLogado?.id}
                          title={u.id === usuarioLogado?.id ? 'Você não pode excluir seu próprio usuário' : 'Excluir usuário'}
                          aria-label={`Excluir usuário ${u.nome}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-slate-800">{modal === 'CRIAR' ? 'Novo Usuário' : 'Editar Usuário'}</h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nome</label>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Login</label>
                <input
                  value={form.login}
                  onChange={(e) => setForm({ ...form, login: e.target.value })}
                  disabled={modal === 'EDITAR'}
                  className={clsx(inputCls, modal === 'EDITAR' && 'bg-slate-100 text-slate-500 cursor-not-allowed')}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Senha {modal === 'EDITAR' && <span className="normal-case font-normal">(deixe em branco para manter)</span>}
                </label>
                <input
                  type="password"
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Papel</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(['OPERADOR', 'ADMIN'] as Papel[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm({ ...form, papel: p })}
                      className={clsx(
                        'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 font-bold text-sm transition-all',
                        form.papel === p
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      )}
                    >
                      {p === 'ADMIN' ? <ShieldCheck size={16} /> : <UserIcon size={16} />}
                      {p === 'ADMIN' ? 'Admin' : 'Operador'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Usuário Protheus (SYS_USR) <span className="normal-case font-normal">(obrigatório para enviar)</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                      value={buscaProtheus}
                      onChange={(e) => {
                        setBuscaProtheus(e.target.value);
                        setBuscaVendedor('');
                        setForm((f) => ({
                          ...f,
                          protheusCodigo: '',
                          protheusNome: '',
                          protheusVendCodigo: '',
                          protheusVendNome: '',
                        }));
                      setProtheusAberto(true);
                    }}
                    onFocus={(e) => {
                      setProtheusAberto(true);
                      e.target.select();
                    }}
                    onBlur={() => setTimeout(() => setProtheusAberto(false), 120)}
                    onKeyDown={handleProtheusKeyDown}
                    disabled={carregandoProtheus}
                    placeholder="Digite o nome ou código..."
                    autoComplete="off"
                    className={clsx(inputCls, 'mt-0 pr-8')}
                  />
                  {form.protheusCodigo && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={limparProtheus}
                      title="Remover vínculo"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}

                  {protheusAberto && !carregandoProtheus && (
                    <div
                      ref={listaProtheusRef}
                      onMouseDown={(e) => e.preventDefault()}
                      className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 max-h-56 overflow-auto"
                    >
                      {sugestoesProtheus.length === 0 ? (
                        <div className="px-4 py-3 text-slate-400 text-sm">Nenhum usuário encontrado.</div>
                      ) : (
                        sugestoesProtheus.map((u, idx) => (
                          <button
                            key={u.codigo}
                            type="button"
                            onClick={() => selecionarProtheus(u)}
                            onMouseEnter={() => setProtheusIndex(idx)}
                            className={clsx(
                              'w-full flex flex-col items-start px-4 py-2 text-left text-sm transition-colors border-b border-slate-100 last:border-0',
                              protheusIndex === idx ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'
                            )}
                          >
                            <span className="font-medium">{u.nome}</span>
                            <span
                              className={clsx(
                                'font-mono text-xs',
                                protheusIndex === idx ? 'text-blue-100' : 'text-slate-400'
                              )}
                            >
                              Código: {u.codigo}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {carregandoProtheus && <p className="text-xs text-slate-400 mt-1">Carregando usuários do Protheus...</p>}
                {erroProtheus && (
                  <p className="text-xs text-red-500 mt-1">Não foi possível consultar o Protheus agora. Você pode salvar sem vínculo.</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Senha Protheus (REST) — opcional para o administrador{' '}
                  <span className="normal-case font-normal">
                    {modal === 'EDITAR' && '(deixe em branco para manter)'}
                  </span>
                </label>
                <input
                  type="password"
                  value={form.protheusSenha}
                  onChange={(e) => setForm({ ...form, protheusSenha: e.target.value })}
                  placeholder={
                    modal === 'EDITAR' && usuarioEmEdicao?.protheusSenhaDefinida ? 'Senha configurada' : 'Senha do login Protheus acima'
                  }
                  className={inputCls}
                />
                <p className="text-xs text-slate-400 mt-1">
                  O próprio usuário poderá cadastrar e validar esta senha em Minha conta. Sem uma senha validada,
                  o PDV ficará bloqueado para vendas, mas o usuário conseguirá entrar no sistema.
                </p>
                <button
                  type="button"
                  onClick={consultarVinculoProtheus}
                  disabled={consultandoVinculo || !form.protheusCodigo}
                  className="mt-3 w-full py-2.5 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {consultandoVinculo ? 'Consultando o Protheus...' : 'Localizar vendedor vinculado no Protheus'}
                </button>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Vendedor vinculado (SA3) <span className="normal-case font-normal">(A3_CODUSR)</span>
                </label>
                <div className="grid grid-cols-[auto_1fr] gap-2 mt-1">
                  <select
                    value={form.protheusVendFilial}
                    onChange={(e) => selecionarFilial(e.target.value)}
                    className={clsx(inputCls, 'mt-0 w-28')}
                  >
                    <option value="">Filial</option>
                    {filiais.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>

                  <div className="relative">
                    <input
                      type="text"
                      value={buscaVendedor}
                      onChange={(e) => {
                        setBuscaVendedor(e.target.value);
                        setForm((f) => ({ ...f, protheusVendCodigo: '', protheusVendNome: '' }));
                        setVendedorAberto(true);
                      }}
                      onFocus={(e) => {
                        setVendedorAberto(true);
                        e.target.select();
                      }}
                      onBlur={() => setTimeout(() => setVendedorAberto(false), 120)}
                      onKeyDown={handleVendedorKeyDown}
                      disabled={!form.protheusVendFilial || !form.protheusCodigo || carregandoVendedores}
                      placeholder={!form.protheusCodigo ? 'Selecione o usuário Protheus' : form.protheusVendFilial ? 'Digite o nome ou código...' : 'Selecione a filial'}
                      autoComplete="off"
                      className={clsx(inputCls, 'mt-0 pr-8')}
                    />
                    {form.protheusVendCodigo && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={limparVendedor}
                        title="Remover vínculo"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={16} />
                      </button>
                    )}

                    {vendedorAberto && form.protheusVendFilial && !carregandoVendedores && (
                      <div
                        ref={listaVendedorRef}
                        onMouseDown={(e) => e.preventDefault()}
                        className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 max-h-56 overflow-auto"
                      >
                        {sugestoesVendedor.length === 0 ? (
                          <div className="px-4 py-3 text-slate-400 text-sm">
                            Nenhum vendedor desta filial está vinculado ao usuário selecionado.
                          </div>
                        ) : (
                          sugestoesVendedor.map((v, idx) => (
                            <button
                              key={v.codigo}
                              type="button"
                              onClick={() => selecionarVendedor(v)}
                              onMouseEnter={() => setVendedorIndex(idx)}
                              className={clsx(
                                'w-full flex flex-col items-start px-4 py-2 text-left text-sm transition-colors border-b border-slate-100 last:border-0',
                                vendedorIndex === idx ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'
                              )}
                            >
                              <span className="font-medium">{v.nome}</span>
                              <span
                                className={clsx(
                                  'font-mono text-xs',
                                  vendedorIndex === idx ? 'text-blue-100' : 'text-slate-400'
                                )}
                              >
                                Código: {v.codigo}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {carregandoVendedores && <p className="text-xs text-slate-400 mt-1">Carregando vendedores da filial...</p>}
                {erroVendedores && (
                  <p className="text-xs text-red-500 mt-1">Não foi possível consultar os vendedores dessa filial.</p>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-b-2xl border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {usuarioParaAlternar && (
        <ConfirmDialog
          titulo={usuarioParaAlternar.ativo ? 'Desativar Usuário' : 'Reativar Usuário'}
          mensagem={
            usuarioParaAlternar.ativo
              ? `Confirma desativar "${usuarioParaAlternar.nome}"? Ele não vai mais conseguir entrar no sistema.`
              : `Confirma reativar "${usuarioParaAlternar.nome}"?`
          }
          variante={usuarioParaAlternar.ativo ? 'perigo' : 'padrao'}
          confirmarLabel={usuarioParaAlternar.ativo ? 'DESATIVAR (ENTER)' : 'REATIVAR (ENTER)'}
          onConfirmar={confirmarAlternarStatus}
          onCancelar={() => setUsuarioParaAlternar(null)}
        />
      )}

      {usuarioParaExcluir && (
        <ConfirmDialog
          titulo="Excluir Usuário"
          mensagem={`Confirma excluir definitivamente "${usuarioParaExcluir.nome}"? Se houver vendas vinculadas, a exclusão será bloqueada e o usuário deverá ser apenas desativado.`}
          variante="perigo"
          confirmarLabel="EXCLUIR (ENTER)"
          onConfirmar={confirmarExclusao}
          onCancelar={() => setUsuarioParaExcluir(null)}
        />
      )}
    </AppShell>
  );
}
