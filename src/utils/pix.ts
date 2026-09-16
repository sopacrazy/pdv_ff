function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

interface DadosPix {
  chave: string;
  nome: string;
  cidade: string;
  valor: number; // reais
  txid?: string;
}

// Monta o payload PIX (BR Code / EMV) para o QR Code de pagamento.
export function gerarPayloadPix({ chave, nome, cidade, valor, txid = '***' }: DadosPix): string {
  const merchantAccountInfo = tlv('26', tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', chave));
  const additionalData = tlv('62', tlv('05', txid));

  const semCrc =
    tlv('00', '01') +
    merchantAccountInfo +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', valor.toFixed(2)) +
    tlv('58', 'BR') +
    tlv('59', nome.substring(0, 25)) +
    tlv('60', cidade.substring(0, 15)) +
    additionalData +
    '6304';

  return semCrc + crc16ccitt(semCrc);
}
