import { VendaDetalhe } from '../services/vendaService';
import { formatMoney } from '../utils/formatters';
import { rotuloFilial } from '../utils/filiais';

// Dados fixos da empresa — mesmos do cabeçalho do bilhete impresso pela Protheus (BILHETE.pdf).
const EMPRESA = {
  nome: 'FORT FRUIT LTDA',
  endereco: 'Alameda Ceasa, SN - Curió',
  cidade: 'Belém - PA - CEP 66.610-120',
  fone: 'Fone: (91) 3245-7463',
  cnpj: 'CNPJ: 02.338.006/0001-07',
};

// Códigos de condição de pagamento usados no PDV (ver ModalPagamento.tsx) — pra trocar o código
// pelo nome no recibo, igual ao "PIX" do modelo (em vez de mostrar só "033").
const NOME_CONDICAO: Record<string, string> = {
  '033': 'PIX',
  '001': 'À VISTA',
};

const formatarCondicao = (formaPagamento: string) =>
  formaPagamento
    .split(', ')
    .map((codigo) => NOME_CONDICAO[codigo] || codigo)
    .join(', ');

const formatarQtd = (valor: number) => (Number.isInteger(valor) ? valor.toFixed(2) : valor.toFixed(3)).replace('.', ',');

const Separador = () => <div className="border-t border-dashed border-black my-1" />;
const SeparadorDuplo = () => <div className="my-1" style={{ borderTop: '4px double black' }} />;
const Linha = ({ esquerda, direita }: { esquerda: string; direita: string }) => (
  <div className="flex justify-between gap-2">
    <span>{esquerda}</span>
    <span>{direita}</span>
  </div>
);

// Modelo pra bobina térmica de 80mm (padrão mais comum em PDV) — se a impressora de vocês for de
// 58mm, é só trocar a largura abaixo e ajustar o tamanho da fonte se precisar. A largura aqui é
// só um teto pra tela; quem define o tamanho real da página impressa é o @page em index.css —
// não repete "80mm" aqui pra não estourar a área já reduzida pela margem do @page.
const LARGURA = 'w-full max-w-[76mm]';

export const ReciboTermico = ({ venda }: { venda: VendaDetalhe }) => {
  const emissao = new Date(venda.criadoEm);
  const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(emissao);
  const hora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(emissao);

  return (
    <div id="area-impressao" className={`hidden print:block font-mono text-black text-[11px] leading-snug ${LARGURA}`}>
      <div className="text-center leading-tight">
        <div className="font-bold text-[13px]">{EMPRESA.nome}</div>
        <div>{EMPRESA.endereco}</div>
        <div>{EMPRESA.cidade}</div>
        <div>{EMPRESA.fone}</div>
        <div>{EMPRESA.cnpj}</div>
      </div>

      <Separador />
      <div className="text-center font-bold">DOCUMENTO SEM VALOR FISCAL</div>
      <Separador />

      <Linha esquerda={`CUPOM: ${venda.numeroCupom}`} direita={`${data} ${hora}`} />
      <Linha esquerda={`LOJA: ${rotuloFilial(venda.loja)}`} direita={`CAIXA: ${venda.caixa}`} />

      <Separador />

      <div className="font-bold">CLIENTE</div>
      <div>{venda.clienteNome || 'Consumidor'}</div>

      <Separador />
      <div className="font-bold">ITENS</div>
      <Separador />
      <div className="h-1" />

      {venda.itens.map((item, idx) => {
        const unidade = item.unidade && item.unidade.toUpperCase() !== 'UN' ? ` ${item.unidade}` : '';
        return (
          <div key={idx} className="mb-1.5">
            <div>
              {item.codigo} {item.descricao}
            </div>
            <Linha
              esquerda={`${formatarQtd(item.quantidade)}${unidade} x ${formatMoney(item.valorUnitario)}`}
              direita={formatMoney(item.valorTotal)}
            />
          </div>
        );
      })}

      <Separador />
      <div>ITENS: {venda.itens.length}</div>
      {/* Subtotal só aparece quando difere do total (ou seja, quando tem desconto) — senão é só
          o mesmo valor repetido, que é exatamente o que devia sumir daqui. */}
      {venda.desconto > 0 && (
        <>
          <Linha esquerda="SUBTOTAL" direita={formatMoney(venda.subtotal)} />
          <Linha esquerda="DESCONTO" direita={`-${formatMoney(venda.desconto)}`} />
        </>
      )}

      <SeparadorDuplo />
      <div className="font-bold text-[16px]">
        <Linha esquerda="TOTAL" direita={formatMoney(venda.total)} />
      </div>
      <SeparadorDuplo />

      <div className="font-bold">PAGAMENTO</div>
      <div>{formatarCondicao(venda.formaPagamento)}</div>
      {venda.valorRecebido != null && <Linha esquerda="Valor recebido" direita={formatMoney(venda.valorRecebido)} />}
      {!!venda.troco && venda.troco > 0 && <Linha esquerda="Troco" direita={formatMoney(venda.troco)} />}

      <Separador />
      <div>Operador: {venda.operador}</div>
      {venda.bilheteProtheus && <div>Bilhete Protheus: {venda.bilheteProtheus}</div>}
      <Separador />

      <div className="text-center pb-4 pt-2">Obrigado pela preferência!</div>
    </div>
  );
};
