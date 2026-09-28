import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { VendaDetalhe } from '../services/vendaService';
import logo from '../assets/bilhete-protheus-logo.png';
import './bilhete-impressao-protheus.css';

// Coordenadas em pontos medidas no BILHETE.pdf. SVG preserva a geometria na impressão.
const decimal = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dinheiro = (n: number) => decimal(n / 100);
const condicoes: Record<string, string> = { '033': 'PIX', '001': 'À VISTA' };
const ITENS_POR_FOLHA = 16;

function Texto({ x, top, size = 9.2083, regular = false, end = false, max, children }: {
  x: number; top: number; size?: number; regular?: boolean; end?: boolean; max?: number; children: ReactNode;
}) {
  const texto = String(children ?? '');
  const comprimento = texto.length * size * 0.6;
  return <text xmlSpace="preserve" x={x} y={top + size * 0.7} fontSize={size} fontWeight={regular ? 400 : 700}
    textAnchor={end ? 'end' : 'start'} {...(max && comprimento > max ? { textLength: max, lengthAdjust: 'spacingAndGlyphs' as const } : {})}>{texto}</text>;
}

function Linha({ x = 26.622, y, w = 539.824, h = 0.712 }: { x?: number; y: number; w?: number; h?: number }) {
  return <rect x={x} y={y} width={w} height={h} />;
}

// Só aparece quando o bilhete saiu sem confirmação do Protheus (ver `offline` em Via) — o número
// impresso nesse caso é o local do PDV, não o oficial, e isso precisa ficar óbvio pra quem for
// conferir o caixa depois.
function MarcaDagua({ y }: { y: number }) {
  return (
    <text x={297.48} y={y} fontSize={80} fontWeight={800} textAnchor="middle" dominantBaseline="middle"
      fill="#dc2626" fillOpacity={0.13} transform={`rotate(-30 297.48 ${y})`}>
      PDV OFFLINE
    </text>
  );
}

function Via({ venda, segunda, itens, inicio, pagina, paginas }: {
  venda: VendaDetalhe; segunda: boolean; itens: VendaDetalhe['itens']; inicio: number; pagina: number; paginas: number;
}) {
  const cab = segunda ? 398.670 : 22.645;
  const tabela = segunda ? 478.433 : 113.802;
  const totalY = segunda ? 682.113 : 328.877;
  const fim = segunda ? 717.722 : 364.486;
  const d = segunda ? 364.6305 : 0;
  const data = venda.dataLocal ? venda.dataLocal.split('-').reverse().join('/') : new Date(venda.criadoEm).toLocaleDateString('pt-BR');
  // Sem confirmação do Protheus ainda (sem internet no momento do envio — ver finalizar() em
  // BilhetePdvPage.tsx), o bilhete sai mesmo assim, mas com o número local do PDV e a marca
  // d'água "PDV OFFLINE" bem visível: ninguém pode confundir esse número com o do Protheus na
  // conferência de caixa. Quando a fila integrar depois, dá pra reimprimir em Consultas já com o
  // número oficial (aí sim sem a marca d'água).
  const offline = !venda.bilheteProtheus;
  const numero = venda.bilheteProtheus || venda.numeroCupom;
  const nome = venda.clienteNome || 'Consumidor';
  const dados = venda.impressao;
  // Por padrão só a 1ª unidade (Modelo 2 / RFATR29.PRW) — mesmo quando o item tem 2ª unidade
  // configurada (ex: CX+KG), a coluna extra fica desligada até pedirem de volta.
  const temUM2 = false;
  const peso = venda.itens.reduce((soma, item) => {
    if (soma == null) return null;
    if (item.unidade?.toUpperCase() === 'KG') return soma + item.quantidade;
    if (item.unidade2?.toUpperCase() === 'KG' && item.quantidade2 != null) return soma + item.quantidade2;
    return item.pesoUnitario != null ? soma + item.quantidade * item.pesoUnitario : null;
  }, 0 as number | null);
  const pesoTotal = dados?.pesoTotal ?? peso;
  const documento = venda.clienteCpf || '';
  const rotuloDocumento = documento.replace(/\D/g, '').length > 11 ? 'C.N.P.J.:' : 'C.P.F.:';
  return <g>
    <Texto x={518.73} top={segunda ? 392.083 : 16.058} size={6.3597} regular>{segunda ? 'Via FortFruit' : 'Via Cliente'}</Texto>
    {paginas > 1 && <Texto x={27.334} top={cab - 6.587} size={6.3597} regular>{`Folha ${pagina}/${paginas}`}</Texto>}
    <Linha y={cab} /><Linha y={cab} w={0.712} h={fim - cab} /><Linha x={566.446} y={cab} w={0.712} h={fim - cab} />
    <Linha x={274.456} y={cab} w={0.712} h={tabela - cab} />
    <Linha x={277.305} y={51.131 + d} w={289.141} />
    <Texto x={27.334} top={segunda ? 401.608 : 29.856} size={13.1039}>FORT FRUIT LTDA</Texto>
    <image href={logo} x={27.334} y={segunda ? 419.323 : 47.571} width={68.368} height={68.368} />
    {['ALAMEDA CEASA, SN', 'CURIO, BELEM, PA', 'CEP: 66.610-120', 'PABX/FAX: 55-91-32457463', 'CNPJ: 02.338.006/0001-07', 'I.E.: 151.977.887.'].map((t, i) =>
      <Texto key={t} x={95.702} top={46.825 + d + i * 11.3947}>{t}</Texto>)}
    <Texto x={277.305} top={35.553 + d} size={13.1039} max={285}>{`${nome}${venda.clienteCodigo ? `(${venda.clienteCodigo})` : ''}`}</Texto>
    <Texto x={277.305} top={58.114 + d} size={11.3947} regular max={181}>{dados?.clienteFantasia || nome}</Texto>
    <Texto x={463.893} top={58.22 + d} max={99}>{`Pedido : ${numero}`}</Texto>
    <Texto x={277.305} top={69.614 + d} max={285}>{dados?.clienteEndereco || ''}</Texto>
    <Texto x={277.305} top={81.009 + d} max={285}>{dados?.clienteCidade || ''}</Texto>
    <Texto x={277.305} top={92.404 + d} max={285}>{`${rotuloDocumento} ${documento} - R.G.: ${dados?.clienteRg || ''}`}</Texto>
    <Texto x={277.305} top={103.798 + d} max={285}>{`Tel.: ${dados?.clienteTelefone || ''}    FAX: ${dados?.clienteFax || ''}`}</Texto>
    <Linha y={tabela} />
    {(temUM2
      ? [[27.334, 'It'], [45.85, 'Codigo'], [87.868, 'Descrição'], [294, 'UM'], [318, 'Quant'], [352, 'Vl.Unit'], [394, 'UM2'], [419, 'Quant'], [454, 'Vl.Unit'], [510, 'Vl.Total']]
      : [[27.334, 'It'], [45.85, 'Codigo'], [87.868, 'Descrição'], [352.083, 'UM'], [384.13, 'Quant'], [425.955, 'Vl.Unit'], [489.365, 'Vl.Total']]
    ).map(([x, t]) => <Texto key={String(t) + x} x={Number(x)} top={tabela + 1.341} size={8.2625}>{t}</Texto>)}
    {itens.map((item, i) => {
      const y = tabela + 12.736 + i * 11.3947;
      const limite = temUM2 ? 290 : 351;
      const descricao = `[    ]   ${item.descricao}  `;
      const caracteres = Math.floor((limite - 87.868) / (8.2625 * 0.6));
      return <g key={inicio + i}>
        <Texto x={27.334} top={y} size={8.2625}>{String(inicio + i + 1).padStart(2, '0')}</Texto>
        <Texto x={45.85} top={y} size={8.2625} max={40}>{item.codigo}</Texto>
        <Texto x={87.868} top={y} size={8.2625} max={limite - 87.868}>{descricao.padEnd(caracteres, '-')}</Texto>
        <Texto x={temUM2 ? 294 : 357.068} top={y} size={8.2625}>{item.unidade || ''}</Texto>
        <Texto x={temUM2 ? 344 : 419.517} top={y} size={8.2625} end max={32}>{item.quantidade.toFixed(2)}</Texto>
        <Texto x={temUM2 ? 386 : 457.974} top={y} size={8.2625} end max={37}>{(item.valorUnitario / 100).toFixed(2)}</Texto>
        {temUM2 && <>
          <Texto x={394} top={y} size={8.2625}>{item.unidade2 || ''}</Texto>
          <Texto x={446} top={y} size={8.2625} end max={30}>{item.quantidade2 == null ? '' : item.quantidade2.toFixed(2)}</Texto>
          <Texto x={490} top={y} size={8.2625} end max={37}>{item.quantidade2 ? (item.valorTotal / item.quantidade2 / 100).toFixed(2) : ''}</Texto>
        </>}
        <Texto x={temUM2 ? 558 : 530.505} top={y} size={8.2625} end max={55}>{dinheiro(item.valorTotal)}</Texto>
      </g>;
    })}
    <Linha y={totalY} /><Linha y={totalY + 11.395} /><Linha y={fim} />
    <Texto x={27.334} top={totalY + 2.815}>Peso Total:</Texto>
    <Texto x={160.39} top={totalY + 1.391} end>{pesoTotal == null ? '' : decimal(pesoTotal)}</Texto>
    <Texto x={277.305} top={totalY + 2.815}>{'Total das Mercadorias  : '}</Texto>
    <Texto x={560.393} top={totalY + 2.938} size={13.1039} end>{dinheiro(venda.total)}</Texto>
    <Linha x={133.447} y={totalY + 11.395} w={0.712} h={24.214} />
    <Linha x={251.667} y={totalY + 11.395} w={0.712} h={12.819} />
    <Texto x={27.334} top={totalY + 14.210} max={104}>{`Condição Pagto: ${venda.formaPagamento}`}</Texto>
    <Texto x={135.584} top={totalY + 14.210} max={113}>{`Rota: ${dados?.rota || ''}`}</Texto>
    <Texto x={254.516} top={totalY + 14.210} max={308}>{`Vendedor : ${dados?.vendedorCodigo ? `(${dados.vendedorCodigo}) - ` : ''}Lançado por ${dados?.vendedorNome || venda.operador}`}</Texto>
    <Texto x={27.334} top={totalY + 25.605} max={103}>{dados?.condicaoDescricao || condicoes[venda.formaPagamento] || venda.formaPagamento}</Texto>
    <Texto x={254.516} top={totalY + 25.605}>{`Emissão: ${data}`}</Texto>
    {segunda && <>
      <Linha y={fim} w={0.712} h={34.184} /><Linha x={566.446} y={fim} w={0.712} h={34.184} /><Linha y={751.906} />
      <Texto x={27.334} top={724.810} max={533}>{`Pedido: ${numero} - Data:${data} - Valor:      ${dinheiro(venda.total)}`}</Texto>
      <Linha x={315.762} y={738.374} w={239.289} />
      <Texto x={315.762} top={741.902} max={239}>{`Cliente ${nome}`}</Texto>
    </>}
    {offline && <MarcaDagua y={(cab + fim) / 2} />}
  </g>;
}

export function FolhasBilheteProtheus({ venda }: { venda: VendaDetalhe }) {
  const paginas = Math.max(1, Math.ceil(venda.itens.length / ITENS_POR_FOLHA));
  return <>{Array.from({ length: paginas }, (_, pagina) => {
    const inicio = pagina * ITENS_POR_FOLHA;
    const itens = venda.itens.slice(inicio, inicio + ITENS_POR_FOLHA);
    const props = { venda, itens, inicio, pagina: pagina + 1, paginas };
    return <svg key={pagina} className="bilhete-folha" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 594.96 841.92" aria-label={`Bilhete, folha ${pagina + 1}`}>
      <Via {...props} segunda={false} />
      <Linha x={19.5} y={381.578} w={564.75} />
      <Via {...props} segunda />
    </svg>;
  })}</>;
}

export const BilheteImpressaoProtheus = ({ venda }: { venda: VendaDetalhe }) => createPortal(
  <div id="area-impressao-bilhete"><FolhasBilheteProtheus venda={venda} /></div>, document.body,
);
