import { consultarVendedoresDaConta } from './protheus-usuario.js';

let validacao;
const VALIDADE_MS = 5 * 60 * 1000;

export function limparCacheContaRestPrincipal() { validacao = undefined; }

export function credenciaisContaRestPrincipal() {
  const usuario = String(process.env.PROTHEUS_REST_USER || '').trim();
  const senha = process.env.PROTHEUS_REST_PASSWORD;
  if (!usuario || !senha) throw new Error('Configure a conta REST principal no servidor (PROTHEUS_REST_USER e PROTHEUS_REST_PASSWORD).');
  return { usuario, senha };
}

// Uma conta ligada à SA3 substituiria o vendedor do JSON no RFATA03.
// Validação compartilhada, sem autenticar cada operador e sem guardar a senha na resposta.
export async function validarContaRestPrincipal({ timeoutMs } = {}) {
  const conta = credenciaisContaRestPrincipal();
  if (!validacao || validacao.usuario !== conta.usuario || validacao.senha !== conta.senha || validacao.ate < Date.now()) {
    const atual = { usuario: conta.usuario, senha: conta.senha, ate: Date.now() + VALIDADE_MS };
    atual.promessa = consultarVendedoresDaConta({ ...conta, filial: '01', timeoutMs }).then(vendedores => {
      if (vendedores.length) throw new Error(`A conta REST principal está vinculada a vendedor na filial 01 (${vendedores.map(v => String(v.code || '').trim()).join(', ')}). Use uma conta técnica sem vínculo SA3 para preservar o vendedor de cada venda.`);
      return { usuario: conta.usuario, validada: true };
    }).catch(erro => {
      if (validacao === atual) validacao = undefined;
      throw erro;
    });
    validacao = atual;
  }
  return validacao.promessa;
}
