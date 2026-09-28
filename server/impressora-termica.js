import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_RAW_PRINT = path.join(__dirname, 'scripts', 'imprimir-raw.ps1');

// Mesmos dados fixos do cabeçalho usados no recibo em HTML (src/components/ReciboTermico.tsx) —
// mantidos duplicados de propósito: um é o modelo antigo via CSS/window.print (cortava nas bordas
// por causa da área não-imprimível que o driver da impressora reporta ao Windows), o outro manda
// bytes ESC/POS direto pro spooler em modo RAW, sem passar pelo motor de página do Chromium.
const EMPRESA = {
  nome: 'FORT FRUIT LTDA',
  endereco: 'Alameda Ceasa, SN - Curió',
  cidade: 'Belém - PA - CEP 66.610-120',
  fone: 'Fone: (91) 3245-7463',
  cnpj: 'CNPJ: 02.338.006/0001-07',
};

const NOME_CONDICAO = { '033': 'PIX', '001': 'À VISTA' };
const NOMES_FILIAIS = { '01': 'Belém', '04': 'Castanhal', '06': 'Piedade' };

const rotuloFilial = (codigo) => (NOMES_FILIAIS[codigo] ? `${codigo} — ${NOMES_FILIAIS[codigo]}` : codigo);

const formatMoney = (centavos) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100);

const formatarQtd = (valor) => (Number.isInteger(valor) ? valor.toFixed(2) : valor.toFixed(3)).replace('.', ',');

const formatarCondicao = (formaPagamento) =>
  String(formaPagamento || '')
    .split(', ')
    .map((codigo) => NOME_CONDICAO[codigo] || codigo)
    .join(', ');

// width: 48 colunas é o padrão da Epson pra bobina de 80mm com a fonte A (12x24) — ver
// "Interface options" / exemplo no README do node-thermal-printer.
function montarBuffer(venda) {
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'buffer-only', // nunca conectamos de fato — só usamos a API pra montar o buffer
    width: 48,
    characterSet: CharacterSet.PC860_PORTUGUESE,
  });

  const emissao = new Date(venda.criadoEm);
  const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(emissao);
  const hora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(emissao);

  // Negrito ligado o cupom inteiro: no ESC/POS isso ativa o modo "emphasized" (traço duplo do
  // cabeçote térmico), que sai bem mais escuro/nítido que o texto normal — é o jeito mais
  // confiável de escurecer a impressão via software, sem depender de ajuste de densidade no driver.
  printer.bold(true);

  printer.alignCenter();
  printer.println(EMPRESA.nome);
  printer.println(EMPRESA.endereco);
  printer.println(EMPRESA.cidade);
  printer.println(EMPRESA.fone);
  printer.println(EMPRESA.cnpj);

  printer.drawLine();
  printer.println('DOCUMENTO SEM VALOR FISCAL');
  printer.drawLine();

  printer.alignLeft();
  printer.leftRight(`CUPOM: ${venda.numeroCupom}`, `${data} ${hora}`);
  printer.leftRight(`LOJA: ${rotuloFilial(venda.loja)}`, `CAIXA: ${venda.caixa}`);
  printer.drawLine();

  printer.println('CLIENTE');
  printer.println(venda.clienteNome || 'Consumidor');

  printer.drawLine();
  printer.println('ITENS');
  printer.drawLine();
  printer.newLine();

  for (const item of venda.itens) {
    const unidade = item.unidade && item.unidade.toUpperCase() !== 'UN' ? ` ${item.unidade}` : '';
    printer.println(`${item.codigo} ${item.descricao}`);
    printer.leftRight(
      `${formatarQtd(item.quantidade)}${unidade} x ${formatMoney(item.valorUnitario)}`,
      formatMoney(item.valorTotal)
    );
  }

  printer.drawLine();
  // Subtotal só aparece quando difere do total (ou seja, quando tem desconto) — igual ao recibo HTML.
  if (venda.desconto > 0) {
    printer.leftRight('SUBTOTAL', formatMoney(venda.subtotal));
    printer.leftRight('DESCONTO', `-${formatMoney(venda.desconto)}`);
  }

  printer.drawLine();
  // setTextSize(1,1) dobra altura E largura juntas (proporcional) — setTextDoubleHeight() sozinho
  // deixava só mais alto, ficando "esticado" em vez de simplesmente maior. Só que em double-width
  // cada caractere ocupa o dobro do espaço físico, então só cabem 24 colunas reais numa linha de
  // 48 — leftRight() não sabe disso (sempre calcula com as 48 colunas do modo normal) e a
  // impressora quebra a linha no meio, jogando o valor pra baixo. Por isso montamos a linha na mão
  // com a largura já dividida por 2.
  const totalFormatado = formatMoney(venda.total);
  const espacosTotal = Math.max(1, 24 - 'TOTAL'.length - totalFormatado.length);
  printer.setTextSize(1, 1);
  printer.print(`TOTAL${' '.repeat(espacosTotal)}${totalFormatado}`);
  printer.newLine();
  printer.setTextNormal();
  printer.drawLine();

  printer.println('PAGAMENTO');
  printer.println(formatarCondicao(venda.formaPagamento));
  if (venda.valorRecebido != null) printer.leftRight('Valor recebido', formatMoney(venda.valorRecebido));
  if (venda.troco > 0) printer.leftRight('Troco', formatMoney(venda.troco));

  printer.drawLine();
  printer.println(`Operador: ${venda.operador}`);
  if (venda.bilheteProtheus) printer.println(`Bilhete Protheus: ${venda.bilheteProtheus}`);
  printer.drawLine();

  printer.alignCenter();
  printer.println('Obrigado pela preferência!');
  printer.newLine();
  printer.newLine();
  printer.cut();

  return printer.getBuffer();
}

// Manda os bytes ESC/POS direto pro spooler do Windows em modo RAW (ver server/scripts/imprimir-raw.ps1)
// — a impressora recebe exatamente esses bytes, sem o Windows aplicar tamanho de página/margem/escala
// por cima como acontecia com window.print() (é isso que causava o corte nas bordas do cupom).
export async function imprimirCupom(venda) {
  const nomeImpressora = process.env.IMPRESSORA_NOME || 'EPSON TM-T (203dpi) Receipt6';
  const buffer = montarBuffer(venda);
  const arquivoTemp = path.join(os.tmpdir(), `cupom-pdv-${randomUUID()}.prn`);
  await fs.writeFile(arquivoTemp, buffer);
  try {
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      SCRIPT_RAW_PRINT,
      '-PrinterName',
      nomeImpressora,
      '-FilePath',
      arquivoTemp,
    ]);
  } finally {
    fs.unlink(arquivoTemp).catch(() => {});
  }
}
