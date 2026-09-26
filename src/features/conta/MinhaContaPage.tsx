import { useState } from 'react';
import { CheckCircle2, KeyRound, LockKeyhole, ShieldAlert, UserRound } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { Toast } from '../../components/Toast';
import { usuarioService } from '../../services/usuarioService';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';

const inputCls =
  'w-full mt-1.5 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all disabled:opacity-60';

export function MinhaContaPage() {
  const { token, usuario, atualizarUsuario } = useAuthStore();
  const { mostrarToast } = useToastStore();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [senhaProtheus, setSenhaProtheus] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [validandoProtheus, setValidandoProtheus] = useState(false);

  if (!usuario) return null;

  const vinculoDefinido = !!(
    usuario.protheusCodigo &&
    usuario.protheusVendFilial &&
    usuario.protheusVendCodigo
  );

  const alterarSenha = async () => {
    if (!token) return;
    if (novaSenha.length < 6) {
      mostrarToast('A nova senha precisa ter pelo menos 6 caracteres.', 'erro');
      return;
    }
    if (novaSenha !== confirmacao) {
      mostrarToast('A confirmação não confere com a nova senha.', 'erro');
      return;
    }
    setSalvandoSenha(true);
    const resultado = await usuarioService.alterarMinhaSenha(token, senhaAtual, novaSenha);
    setSalvandoSenha(false);
    if (!resultado.sucesso) {
      mostrarToast(resultado.erro || 'Não foi possível alterar a senha.', 'erro');
      return;
    }
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmacao('');
    mostrarToast('Senha do PDV alterada com sucesso.', 'sucesso');
  };

  const validarProtheus = async () => {
    if (!token || !senhaProtheus) return;
    setValidandoProtheus(true);
    const resultado = await usuarioService.salvarMinhaSenhaProtheus(token, senhaProtheus);
    setValidandoProtheus(false);
    if (!resultado.sucesso || !resultado.usuario) {
      mostrarToast(resultado.erro || 'Não foi possível validar sua conta no Protheus.', 'erro');
      return;
    }
    atualizarUsuario(resultado.usuario);
    setSenhaProtheus('');
    mostrarToast('Conta Protheus validada. O PDV foi liberado para vendas.', 'sucesso');
  };

  return (
    <AppShell rotaAtiva="/minha-conta">
      <Toast />

      <header className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-6 py-4 flex items-center gap-3">
        <UserRound size={22} className="text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Minha conta</h1>
          <p className="text-sm text-slate-400">Segurança do PDV e acesso ao Protheus</p>
        </div>
      </header>

      <div
        className={`rounded-2xl border px-5 py-4 flex items-start gap-3 ${
          usuario.prontoParaVender
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}
      >
        {usuario.prontoParaVender ? <CheckCircle2 className="shrink-0" /> : <ShieldAlert className="shrink-0" />}
        <div>
          <p className="font-bold">
            {usuario.prontoParaVender ? 'Conta pronta para vender' : 'PDV bloqueado para vendas'}
          </p>
          <p className="text-sm mt-0.5 opacity-80">
            {usuario.prontoParaVender
              ? 'Seu usuário, vendedor e senha Protheus estão configurados.'
              : vinculoDefinido
                ? 'Cadastre sua senha Protheus abaixo para liberar o PDV.'
                : 'O administrador precisa vincular seu usuário e vendedor do Protheus.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <KeyRound size={18} className="text-blue-600" /> Conta Protheus
            </h2>
            <p className="text-sm text-slate-400 mt-1">A senha é cifrada e nunca é exibida novamente.</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs uppercase font-bold text-slate-400">Usuário</p>
                <p className="font-medium text-slate-700 mt-1">{usuario.protheusNome || 'Não vinculado'}</p>
                <p className="font-mono text-xs text-slate-400">{usuario.protheusCodigo || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs uppercase font-bold text-slate-400">Vendedor</p>
                <p className="font-medium text-slate-700 mt-1">{usuario.protheusVendNome || 'Não vinculado'}</p>
                <p className="font-mono text-xs text-slate-400">
                  {usuario.protheusVendCodigo ? `Filial ${usuario.protheusVendFilial} / ${usuario.protheusVendCodigo}` : '—'}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Senha Protheus</label>
              <input
                type="password"
                value={senhaProtheus}
                onChange={(e) => setSenhaProtheus(e.target.value)}
                disabled={!vinculoDefinido || validandoProtheus}
                placeholder={usuario.protheusSenhaDefinida ? 'Digite para validar uma nova senha' : 'Digite sua senha do Protheus'}
                autoComplete="new-password"
                className={inputCls}
              />
            </div>

            <button
              onClick={validarProtheus}
              disabled={!vinculoDefinido || !senhaProtheus || validandoProtheus}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors disabled:opacity-50"
            >
              {validandoProtheus ? 'Validando no Protheus...' : usuario.protheusSenhaDefinida ? 'Atualizar e validar senha' : 'Salvar e liberar PDV'}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <LockKeyhole size={18} className="text-blue-600" /> Senha do PDV
            </h2>
            <p className="text-sm text-slate-400 mt-1">Altere a senha usada para entrar neste sistema.</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Senha atual</label>
              <input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} autoComplete="current-password" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nova senha</label>
              <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoComplete="new-password" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Confirmar nova senha</label>
              <input type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" className={inputCls} />
            </div>
            <button
              onClick={alterarSenha}
              disabled={!senhaAtual || !novaSenha || !confirmacao || salvandoSenha}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition-colors disabled:opacity-50"
            >
              {salvandoSenha ? 'Alterando...' : 'Alterar senha do PDV'}
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
