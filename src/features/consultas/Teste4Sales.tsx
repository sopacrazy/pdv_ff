import { useState } from 'react';

type Resultado = { status?: number; httpOk?: boolean; resposta?: unknown; erro?: string; mensagem?: string; duracaoMs?: number };
type Previa = {
  documento: unknown; url: string; enviado: boolean; resultado: Resultado | null;
  resumo: { id: string; tenant: string; cliente: string; loja: string; vendedor: string; condicao: string; itens: number; total: number; data: string };
};

export function Teste4Sales({ token }: { token: string }) {
  const [aberto, setAberto] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [tentou, setTentou] = useState(false);

  async function carregar() {
    setAberto(true); setOcupado(true); setErro('');
    try {
      const r = await fetch('/api/protheus/4sales-teste', { headers: { Authorization: `Bearer ${token}` } });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro || `HTTP ${r.status}`);
      setPrevia(dados); setResultado(dados.resultado); setTentou(dados.enviado);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar prévia'); }
    finally { setOcupado(false); }
  }

  async function enviar() {
    if (!previa || ocupado || tentou) return;
    setOcupado(true); setTentou(true); setErro('');
    try {
      const r = await fetch('/api/protheus/4sales-teste', { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento: previa.documento }) });
      const dados = await r.json();
      setResultado(dados);
      if (!r.ok) setErro(dados.erro || `HTTP ${r.status}`);
    } catch (e) {
      setErro('Sem confirmação do servidor. Use Consultar resultado antes de qualquer nova tentativa.');
    } finally { setOcupado(false); }
  }

  return <section className="mx-4 mt-4 p-4 rounded-xl border border-indigo-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-bold text-slate-800">Teste de bilhete · 4Sales</h2>
        <p className="text-sm text-slate-500">Usa o arquivo enviado pela empresa na base de teste.</p></div>
      <button disabled={ocupado} onClick={aberto ? () => setAberto(false) : carregar}
        className="rounded-lg bg-indigo-50 text-indigo-700 px-4 py-2 font-semibold disabled:opacity-50">
        {aberto ? 'Recolher' : 'Preparar teste'}
      </button>
    </div>
    {aberto && <div className="mt-4 space-y-3">
      {erro && <p role="alert" className="text-red-700">{erro}</p>}
      {ocupado && <p role="status">{tentou ? 'Aguardando Protheus (até 150 segundos)…' : 'Carregando…'}</p>}
      {previa && <>
        <p className="text-xs text-slate-500 break-all">POST {previa.url}</p>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {Object.entries({ Pedido: previa.resumo.id, 'Empresa/filial': previa.resumo.tenant,
            'Cliente/loja': `${previa.resumo.cliente}/${previa.resumo.loja}`, Vendedor: previa.resumo.vendedor,
            Condição: previa.resumo.condicao, Itens: previa.resumo.itens, Data: previa.resumo.data,
            Total: previa.resumo.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }).map(([k,v]) =>
              <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-semibold break-all">{v}</dd></div>)}
        </dl>
        <p className="text-sm rounded-lg bg-amber-50 p-3 text-amber-900">
          O envio pode incluir e efetivar este bilhete no Protheus, com estoque e financeiro.
          Este teste não altera as vendas locais do PDV.
        </p>
        <details><summary className="cursor-pointer text-sm text-indigo-700">Conferir JSON e cabeçalhos</summary>
          <pre className="mt-2 max-h-72 overflow-auto bg-slate-50 p-3 text-xs whitespace-pre-wrap break-all">{JSON.stringify(previa.documento, null, 2)}</pre>
        </details>
        <div className="flex flex-wrap gap-3">
          <button onClick={enviar} disabled={ocupado || tentou}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 font-semibold disabled:opacity-40">
            {tentou ? 'Envio já solicitado' : 'Enviar bilhete à base de teste'}
          </button>
          <button onClick={carregar} disabled={ocupado} className="rounded-lg border px-4 py-2 disabled:opacity-40">Consultar resultado</button>
        </div>
        {tentou && !resultado && !ocupado && <p className="text-sm text-amber-800">Tentativa registrada. Aguarde ou confira no Protheus; não repita o envio.</p>}
      </>}
      {resultado && <div className="rounded-lg bg-slate-100 p-3" aria-live="polite">
        <h3 className="font-semibold">{resultado.status ? `Resposta do Protheus · HTTP ${resultado.status}` : 'Resultado do envio'}</h3>
        <p className="text-sm">{resultado.mensagem || resultado.erro}</p>
        <pre className="mt-2 max-h-80 overflow-auto text-xs whitespace-pre-wrap break-all">{JSON.stringify(resultado.resposta ?? resultado, null, 2)}</pre>
      </div>}
    </div>}
  </section>;
}
