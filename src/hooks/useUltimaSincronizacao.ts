import { useEffect, useState } from 'react';

export function useUltimaSincronizacao(intervaloMs = 30000): Date | null {
  const [ultima, setUltima] = useState<Date | null>(null);

  useEffect(() => {
    let cancelado = false;

    const verificar = async () => {
      try {
        const resp = await fetch('/api/sync/status', { signal: AbortSignal.timeout(3000) });
        if (!resp.ok) return;
        const corpo = await resp.json();
        if (!cancelado && corpo.ultimaSincronizacao) {
          setUltima(new Date(corpo.ultimaSincronizacao));
        }
      } catch {
        // mantém o último valor conhecido em caso de falha pontual
      }
    };

    verificar();
    const timer = setInterval(verificar, intervaloMs);
    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, [intervaloMs]);

  return ultima;
}
