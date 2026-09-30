import './env.js';

export function resolverUrls4Sales(baseConfigurada = process.env.PROTHEUS_REST_URL) {
  if (!String(baseConfigurada || '').trim()) throw new Error('Configure PROTHEUS_REST_URL no servidor.');
  const base = new URL(String(baseConfigurada).trim());
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('PROTHEUS_REST_URL deve ser uma URL HTTP/HTTPS sem credenciais, parâmetros ou fragmento.');
  }
  base.pathname = `${base.pathname.replace(/\/+$/, '')}/`;
  return { base: base.href, pedidos: new URL('4SALFORTFRUITORDERS', base).href };
}
