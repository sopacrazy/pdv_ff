import crypto from 'crypto';

// Login Protheus (REST) de cada operador fica guardado cifrado no SQLite — não dá pra usar hash
// (como a senha do PDV) porque essa senha precisa ser recuperada em texto puro pra montar o Basic
// Auth da chamada ao 4Sales. A chave vem de PROTHEUS_CRED_SECRET (.env), nunca do banco.
function chave() {
  const segredo = process.env.PROTHEUS_CRED_SECRET;
  if (!segredo) {
    throw new Error('Configure PROTHEUS_CRED_SECRET no .env do servidor para guardar login Protheus por operador.');
  }
  return crypto.createHash('sha256').update(segredo).digest();
}

// iv + authTag + texto cifrado, tudo num único campo base64 (evita colunas extras no banco).
export function cifrarSenhaProtheus(texto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), cifrado]).toString('base64');
}

export function decifrarSenhaProtheus(base64) {
  const dados = Buffer.from(base64, 'base64');
  const iv = dados.subarray(0, 12);
  const tag = dados.subarray(12, 28);
  const cifrado = dados.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
}
