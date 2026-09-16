/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { AppRoutes } from './routes';
import { usePdvStore } from './store/pdvStore';

export default function App() {
  const carregarEstadoCaixa = usePdvStore((state) => state.carregarEstadoCaixa);

  useEffect(() => {
    carregarEstadoCaixa();
  }, [carregarEstadoCaixa]);

  return <AppRoutes />;
}
