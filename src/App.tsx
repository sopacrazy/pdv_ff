/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { AppRoutes } from './routes';
import { usePdvStore } from './store/pdvStore';
import { useAuthStore } from './store/authStore';
import { estaNoAppNativo, obterApiBaseUrl } from './services/apiBase';
import { ConfiguracaoServidorPage } from './features/auth/ConfiguracaoServidorPage';
import { useImpressaoBilheteProtheus } from './hooks/useImpressaoBilheteProtheus';
import { BilheteImpressaoProtheus } from './components/BilheteImpressaoProtheus';
import { configurarAtualizacaoAutomatica } from './services/atualizacaoApp';

export default function App() {
  const carregarEstadoCaixa = usePdvStore((state) => state.carregarEstadoCaixa);
  const restaurarSessao = useAuthStore((state) => state.restaurarSessao);
  // Só o app Android depende disso — sem um servidor configurado ele nem sabe pra onde mandar o
  // login. No navegador normal (servido pelo próprio Express do PC) já entra sempre "configurado".
  const [servidorConfigurado, setServidorConfigurado] = useState(!estaNoAppNativo() || !!obterApiBaseUrl());
  // Fica aqui na raiz (não dentro da tela de Bilhete) pra sobreviver à troca de rota — o envio ao
  // Protheus pode levar até 150s pra responder, e o operador costuma já estar em Consultas quando
  // a confirmação chega (ver src/hooks/useImpressaoBilheteProtheus.ts).
  const { vendaParaImprimir } = useImpressaoBilheteProtheus();

  useEffect(() => {
    if (!servidorConfigurado) return;
    restaurarSessao().then(carregarEstadoCaixa);
    void configurarAtualizacaoAutomatica();
  }, [servidorConfigurado, carregarEstadoCaixa, restaurarSessao]);

  if (!servidorConfigurado) {
    return <ConfiguracaoServidorPage aoConfigurar={() => setServidorConfigurado(true)} />;
  }

  return (
    <>
      {/* print:hidden aqui (não em cada página) porque a impressão pode disparar com QUALQUER
          rota montada — o envio ao Protheus roda em segundo plano, o operador pode já estar em
          Consultas quando a confirmação chega. Sem isso, a tela ativa apareceria junto do bilhete
          na hora de imprimir. */}
      <div className="print:hidden">
        <AppRoutes />
      </div>
      {vendaParaImprimir && <BilheteImpressaoProtheus venda={vendaParaImprimir} />}
    </>
  );
}
