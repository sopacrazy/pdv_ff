import { useEffect, useState } from 'react';

// Diferente de useStatusConexao (que só confirma o servidor local do PDV): este hook testa se a
// internet de verdade está de pé, tentando alcançar o host do Protheus. É o que importa pra saber
// se "Enviar ao Protheus" vai funcionar agora — o PDV continua vendendo local mesmo se isso der offline.
export function useStatusInternet(intervaloMs = 15000): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelado = false;

    const verificar = async () => {
      try {
        const resp = await fetch('/api/protheus/conexao', { signal: AbortSignal.timeout(6000) });
        const corpo = await resp.json().catch(() => ({ online: false }));
        if (!cancelado) setOnline(!!corpo.online);
      } catch {
        if (!cancelado) setOnline(false);
      }
    };

    verificar();
    const timer = setInterval(verificar, intervaloMs);
    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, [intervaloMs]);

  return online;
}
