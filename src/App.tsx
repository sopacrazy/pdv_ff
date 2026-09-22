/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { AppRoutes } from './routes';
import { usePdvStore } from './store/pdvStore';
import { useAuthStore } from './store/authStore';

export default function App() {
  const carregarEstadoCaixa = usePdvStore((state) => state.carregarEstadoCaixa);
  const restaurarSessao = useAuthStore((state) => state.restaurarSessao);

  useEffect(() => {
    restaurarSessao().then(carregarEstadoCaixa);
  }, [carregarEstadoCaixa, restaurarSessao]);

  return <AppRoutes />;
}
