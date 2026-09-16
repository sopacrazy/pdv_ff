import { useEffect, useState } from 'react';

export function useStatusConexao(intervaloMs = 10000): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelado = false;

    const verificar = async () => {
      try {
        const resp = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        if (!cancelado) setOnline(resp.ok);
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
