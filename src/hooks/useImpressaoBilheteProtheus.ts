import { useEffect } from 'react';
import { useImpressaoBilheteStore } from '../store/impressaoBilheteStore';

// Efeito de impressão em si — chamado UMA ÚNICA VEZ, no App.tsx (nível raiz), nunca dentro de uma
// página específica. O estado que ele observa (useImpressaoBilheteStore) é global bem de
// propósito: o envio ao Protheus pode levar até 150s pra responder, tempo de sobra pro operador
// navegar pra outra tela antes da resposta voltar — um efeito preso ao componente da tela de
// Bilhete desmontaria nesse meio tempo e a impressão nunca dispararia. Ver
// src/features/bilhetes/BilhetePdvPage.tsx e ConsultasPage.tsx: eles só chamam
// `useImpressaoBilheteStore((s) => s.imprimirBilhete)` pra disparar, sem duplicar este efeito.
//
// Impressão automática, sem diálogo: dentro do Electron (app desktop de verdade), chama o
// processo principal via IPC (ver electron/preload.cjs e electron/main.cjs), que manda direto pra
// impressora marcada como padrão no Windows através de webContents.print({silent:true}) — sem
// isso, window.print() sempre abre o diálogo do navegador pedindo confirmação. Fora do Electron
// (ex: `npm run dev` no navegador puro, sem o preload carregado) cai de volta no window.print()
// normal. Diferente do cupom térmico (useImpressaoCupom.ts, que manda ESC/POS direto pro
// spooler): o bilhete sai numa impressora A4 comum, então usar a API de impressão "normal" do
// Chromium (que já respeita o @media print da página) é o caminho certo aqui.
export function useImpressaoBilheteProtheus() {
  const vendaParaImprimir = useImpressaoBilheteStore((s) => s.vendaParaImprimir);
  const limparImpressao = useImpressaoBilheteStore((s) => s.limparImpressao);

  useEffect(() => {
    if (!vendaParaImprimir) return;
    let cancelado = false;
    let frame = 0;
    // O logo SVG usa uma imagem externa: esperar a decodificação evita a primeira via sem logo.
    const imagens = Array.from(document.querySelectorAll<SVGImageElement>('#area-impressao-bilhete image'));
    const carregamentos = imagens.map(elemento => {
      const imagem = new Image();
      imagem.src = elemento.href.baseVal;
      return imagem.decode().catch(() => undefined);
    });
    void Promise.all([document.fonts.ready, ...carregamentos]).then(() => {
      if (cancelado) return;
      if (window.electronAPI) {
        // Sem afterprint aqui (window.print() não é chamado) — a Promise resolvendo já marca o fim.
        void window.electronAPI.imprimirSilencioso().then(() => {
          if (!cancelado) limparImpressao();
        });
      } else {
        frame = requestAnimationFrame(() => { if (!cancelado) window.print(); });
      }
    });
    return () => { cancelado = true; cancelAnimationFrame(frame); };
  }, [vendaParaImprimir, limparImpressao]);

  useEffect(() => {
    window.addEventListener('afterprint', limparImpressao);
    return () => window.removeEventListener('afterprint', limparImpressao);
  }, [limparImpressao]);

  return { vendaParaImprimir };
}
